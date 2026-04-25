import { BannerSsbClient } from "./client";
import {
  MAX_SEARCH_RESULT_PAGES,
  SEARCH_RESULTS_PAGE_SIZE,
} from "./constants";
import { replaceTermData } from "./ingest-term";
import type { Database } from "@/db/index";
import {
  courseKey,
  mapSectionRowToGraph,
  parseLinkedData,
  pickLinkedAnchorCrn,
  type ParsedLinkedBundle,
} from "./mappers";
import type { BannerSectionRow } from "./types";

export type ScrapeFullTermOptions = {
  /** When false, skips `fetchLinkedSections` (e.g. archive runs). Default true. */
  includeLinked?: boolean;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/**
 * Full term scrape + DB replace: Banner HTTP + `replaceTermData`.
 * Intended to run inside a Workflow `"use step"` (or any long-lived Node context).
 */
export async function scrapeFullTermToDatabase(
  db: Database,
  termCode: string,
  hotRun: boolean,
  options: ScrapeFullTermOptions = {},
): Promise<{ subjects: number; sections: number; linkedBundles: number }> {
  const includeLinked = options.includeLinked !== false;
  const origin = requireEnv("BANNER_ORIGIN");

  const client = new BannerSsbClient(origin);
  await client.warmTermSelection();
  await client.selectTermAndLoadClassSearch(termCode);

  const terms = await client.getTerms();
  const termRow = terms.find((t) => t.code === termCode);
  const termDescription = termRow?.description ?? termCode;

  const subjects = await client.getAllSubjects(termCode);
  const byCrn = new Map<string, BannerSectionRow>();

  for (const subj of subjects) {
    await client.resetDataForm();
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
    }
  }

  const linkedParsed: ParsedLinkedBundle[] = [];
  if (includeLinked) {
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
      const anchor = pickLinkedAnchorCrn(groupRows);
      if (!anchor) continue;
      const sub0 = groupRows[0]?.subject;
      const num0 = groupRows[0]?.courseNumber;
      if (typeof sub0 !== "string" || typeof num0 !== "string") continue;
      const dedupeKey = courseKey(sub0, num0);
      if (seenCourseFetch.has(dedupeKey)) continue;
      seenCourseFetch.add(dedupeKey);

      const payload = await client.fetchLinkedSections(termCode, anchor);
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

  const graphs = [];
  for (const row of byCrn.values()) {
    const g = mapSectionRowToGraph(termCode, row);
    if (g) graphs.push(g);
  }

  await replaceTermData(db, {
    termCode,
    termDescription,
    graphs,
    linkedBundles: linkedParsed,
    hotRun,
  });

  return {
    subjects: subjects.length,
    sections: graphs.length,
    linkedBundles: linkedParsed.length,
  };
}
