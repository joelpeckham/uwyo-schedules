import { eq } from "drizzle-orm";
import { decodeHtmlEntities } from "@/lib/text/decodeHtmlEntities";
import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { BannerSsbClient } from "./client";
import {
  bannerPolitenessDelay,
  MAX_SEARCH_RESULT_PAGES,
  SEARCH_RESULTS_PAGE_SIZE,
} from "./constants";
import { syncTermData } from "./ingest-term";
import {
  courseKey,
  linkedFetchAnchorCrns,
  mapSectionRowToGraph,
  parseLinkedData,
  type ParsedLinkedBundle,
} from "./mappers";
import type { BannerSectionRow } from "./types";
import {
  emptyDbStats,
  emptyIngestStepStats,
  mergeDbStats,
  type DbCallStats,
  type IngestStepStats,
} from "@/lib/ingest/stats";

type ScrapeFullTermOptions = {
  /** When false, skips `fetchLinkedSections` (e.g. archive runs). Default true. */
  includeLinked?: boolean;
  /**
   * When true (default for hot runs), skip linked fetches for courses whose
   * linked CRNs are already present in `linked_bundle_members`.
   */
  gateLinkedFetches?: boolean;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function loadLinkedMemberCrns(
  db: Database,
  termCode: string,
): Promise<{ crns: Set<string>; db: DbCallStats }> {
  const dbStats = emptyDbStats();
  dbStats.selects += 1;
  const rows = await db
    .select({ crn: schema.linkedBundleMembers.crn })
    .from(schema.linkedBundleMembers)
    .innerJoin(
      schema.linkedBundles,
      eq(schema.linkedBundleMembers.bundleId, schema.linkedBundles.id),
    )
    .where(eq(schema.linkedBundles.termCode, termCode));
  return {
    crns: new Set(rows.map((r) => r.crn)),
    db: dbStats,
  };
}

function courseLinkedCrnsFullyCovered(
  rows: BannerSectionRow[],
  coveredMemberCrns: Set<string>,
): boolean {
  for (const row of rows) {
    if (!row.isSectionLinked) continue;
    const crn = row.courseReferenceNumber;
    if (typeof crn === "string" && crn.length > 0 && !coveredMemberCrns.has(crn)) {
      return false;
    }
  }
  return true;
}

/**
 * Full term scrape + DB sync: Banner HTTP + `syncTermData`.
 * Intended to run inside a Workflow `"use step"` (or any long-lived Node context).
 */
export async function scrapeFullTermToDatabase(
  db: Database,
  termCode: string,
  hotRun: boolean,
  options: ScrapeFullTermOptions = {},
): Promise<{
  subjects: number;
  sections: number;
  linkedBundles: number;
  stats: IngestStepStats;
}> {
  const includeLinked = options.includeLinked !== false;
  const gateLinkedFetches =
    options.gateLinkedFetches ?? hotRun;
  const origin = requireEnv("BANNER_ORIGIN");
  let politenessDelaysMs = 0;
  let linkedCoursesSkipped = 0;
  const stats = emptyIngestStepStats();

  const client = new BannerSsbClient(origin);
  await client.warmTermSelection();
  politenessDelaysMs += await bannerPolitenessDelay();
  await client.selectTermAndLoadClassSearch(termCode);
  politenessDelaysMs += await bannerPolitenessDelay();

  const terms = await client.getTerms();
  politenessDelaysMs += await bannerPolitenessDelay();
  const termRow = terms.find((t) => t.code === termCode);
  const termDescription =
    decodeHtmlEntities(termRow?.description) ?? termCode;

  const subjects = await client.getAllSubjects(termCode);
  politenessDelaysMs += await bannerPolitenessDelay();
  const byCrn = new Map<string, BannerSectionRow>();

  for (const subj of subjects) {
    await client.resetDataForm();
    politenessDelaysMs += await bannerPolitenessDelay();
    let pageOffset = 0;
    for (let page = 0; page < MAX_SEARCH_RESULT_PAGES; page++) {
      const res = await client.getSearchResultsPage(termCode, subj.code, pageOffset);
      if (!res.success) {
        throw new Error(
          `Banner searchResults failed for subject=${subj.code} offset=${pageOffset}`,
        );
      }
      const data = res.data;
      if (data === null || !Array.isArray(data)) {
        throw new Error(
          `Banner searchResults invalid session for subject=${subj.code} offset=${pageOffset}`,
        );
      }
      if (data.length === 0) break;

      for (const row of data) {
        const crn = row.courseReferenceNumber;
        if (typeof crn === "string" && crn.length > 0) {
          byCrn.set(crn, row as BannerSectionRow);
        }
      }

      pageOffset += data.length;
      const total = res.totalCount;
      if (typeof total === "number" && pageOffset >= total) break;
      if (
        data.length < SEARCH_RESULTS_PAGE_SIZE &&
        (total === undefined || total === 0)
      ) {
        break;
      }
      politenessDelaysMs += await bannerPolitenessDelay();
    }
  }

  const linkedParsed: ParsedLinkedBundle[] = [];
  if (includeLinked) {
    const linkedCoverage = gateLinkedFetches
      ? await loadLinkedMemberCrns(db, termCode)
      : { crns: new Set<string>(), db: emptyDbStats() };
    stats.db = linkedCoverage.db;
    const coveredMemberCrns = linkedCoverage.crns;

    const courseGroups = new Map<string, BannerSectionRow[]>();
    for (const row of byCrn.values()) {
      if (!row.isSectionLinked) continue;
      const sub = row.subject;
      const num = row.courseNumber;
      if (typeof sub !== "string" || typeof num !== "string") continue;
      const k = courseKey(sub, num);
      const arr = courseGroups.get(k) ?? [];
      arr.push(row);
      courseGroups.set(k, arr);
    }

    const seenCourseFetch = new Set<string>();
    for (const groupRows of courseGroups.values()) {
      const sub0 = groupRows[0]?.subject;
      const num0 = groupRows[0]?.courseNumber;
      if (typeof sub0 !== "string" || typeof num0 !== "string") continue;
      const dedupeKey = courseKey(sub0, num0);
      if (seenCourseFetch.has(dedupeKey)) continue;

      if (
        gateLinkedFetches &&
        courseLinkedCrnsFullyCovered(groupRows, coveredMemberCrns)
      ) {
        linkedCoursesSkipped += 1;
        continue;
      }

      seenCourseFetch.add(dedupeKey);

      const anchors = linkedFetchAnchorCrns(groupRows);
      for (const anchor of anchors) {
        const payload = await client.fetchLinkedSections(termCode, anchor);
        politenessDelaysMs += await bannerPolitenessDelay();
        const bundles = parseLinkedData(anchor, payload);
        linkedParsed.push(...bundles);

        for (const bundle of payload.linkedData ?? []) {
          if (!Array.isArray(bundle)) continue;
          for (const member of bundle) {
            const c = member.courseReferenceNumber;
            if (typeof c === "string" && c && !byCrn.has(c)) {
              byCrn.set(c, member as BannerSectionRow);
            }
          }
        }
      }
    }
  }

  const graphs = [];
  for (const row of byCrn.values()) {
    const g = mapSectionRowToGraph(termCode, row);
    if (g) graphs.push(g);
  }

  const syncResult = await syncTermData(db, {
    termCode,
    termDescription,
    graphs,
    linkedBundles: linkedParsed,
    hotRun,
  });

  stats.banner = client.getBannerStats();
  stats.db = mergeDbStats(stats.db, syncResult.db);
  stats.sectionSync = syncResult.sectionSync;
  stats.scrape = {
    subjects: subjects.length,
    sections: graphs.length,
    linkedBundles: linkedParsed.length,
    linkedCoursesSkipped,
    politenessDelaysMs,
  };

  return {
    subjects: subjects.length,
    sections: graphs.length,
    linkedBundles: linkedParsed.length,
    stats,
  };
}
