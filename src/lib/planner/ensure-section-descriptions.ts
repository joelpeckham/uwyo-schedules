import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { BannerSsbClient } from "@/lib/banner-ssb/client";
import { parseCourseDescriptionHtml } from "@/lib/banner-ssb/parse-course-description";
import {
  emptyIngestStepStats,
  type IngestStepStats,
} from "@/lib/ingest/stats";
import { and, eq, inArray, isNull } from "drizzle-orm";

const FETCH_DELAY_MS = 150;

export const DESCRIPTION_STALE_SOFT_DAYS = 2;
export const DESCRIPTION_STALE_HARD_DAYS = 7;
export const DESCRIPTION_STALE_SOFT_SAMPLE_RATE = 0.25;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type DescriptionRow = {
  crn: string;
  courseDescription: string | null;
  sectionInformationText: string | null;
};

type ParsedDescriptionUpdate = {
  crn: string;
  courseDescription: string | null;
  sectionInformationText: string | null;
  descriptionsFetchedAt: Date;
  contentChanged: boolean;
};

type EnsureSectionDescriptionsOptions = {
  /**
   * When true (planner on-demand path), skip CRNs that already have
   * `descriptions_fetched_at`. Workflow passes pre-filtered stale CRNs with false.
   */
  onlyUncached?: boolean;
};

async function batchApplyDescriptionUpdates(
  db: Database,
  termCode: string,
  updates: ParsedDescriptionUpdate[],
): Promise<number> {
  if (updates.length === 0) return 0;

  let dbUpdates = 0;
  await db.transaction(async (tx) => {
    for (const update of updates) {
      if (update.contentChanged) {
        dbUpdates += 1;
        await tx
          .update(schema.sections)
          .set({
            courseDescription: update.courseDescription,
            sectionInformationText: update.sectionInformationText,
            descriptionsFetchedAt: update.descriptionsFetchedAt,
          })
          .where(
            and(
              eq(schema.sections.termCode, termCode),
              eq(schema.sections.crn, update.crn),
            ),
          );
      } else {
        dbUpdates += 1;
        await tx
          .update(schema.sections)
          .set({ descriptionsFetchedAt: update.descriptionsFetchedAt })
          .where(
            and(
              eq(schema.sections.termCode, termCode),
              eq(schema.sections.crn, update.crn),
            ),
          );
      }
    }
  });
  return dbUpdates;
}

/**
 * Fetch Banner course/section descriptions for the given CRNs.
 * Best-effort: failures for individual CRNs are logged and skipped.
 */
export async function ensureSectionDescriptions(
  db: Database,
  termCode: string,
  crns: string[],
  options: EnsureSectionDescriptionsOptions = {},
): Promise<IngestStepStats> {
  const stats = emptyIngestStepStats();
  if (crns.length === 0) return stats;

  stats.descriptions = {
    crnsRequested: crns.length,
    crnsFetched: 0,
    contentChanged: 0,
    timestampOnly: 0,
    failures: 0,
  };

  const whereParts = [
    eq(schema.sections.termCode, termCode),
    inArray(schema.sections.crn, crns),
  ];
  if (options.onlyUncached) {
    whereParts.push(isNull(schema.sections.descriptionsFetchedAt));
  }

  stats.db.selects += 1;
  const rows = await db
    .select({
      crn: schema.sections.crn,
      courseDescription: schema.sections.courseDescription,
      sectionInformationText: schema.sections.sectionInformationText,
    })
    .from(schema.sections)
    .where(and(...whereParts));

  if (rows.length === 0) return stats;

  const priorByCrn = new Map<string, DescriptionRow>(
    rows.map((r) => [r.crn, r]),
  );

  const origin = requireEnv("BANNER_ORIGIN");
  const client = new BannerSsbClient(origin);
  await client.warmTermSelection();
  await client.selectTermAndLoadClassSearch(termCode);

  const pendingUpdates: ParsedDescriptionUpdate[] = [];

  for (const { crn } of rows) {
    try {
      const html = await client.getCourseDescriptionHtml(termCode, crn);
      const parsed = parseCourseDescriptionHtml(html);
      const prior = priorByCrn.get(crn);
      const contentChanged =
        parsed.courseDescription !== (prior?.courseDescription ?? null) ||
        parsed.sectionInformationText !==
          (prior?.sectionInformationText ?? null);

      pendingUpdates.push({
        crn,
        courseDescription: parsed.courseDescription,
        sectionInformationText: parsed.sectionInformationText,
        descriptionsFetchedAt: new Date(),
        contentChanged,
      });
      stats.descriptions!.crnsFetched += 1;
      if (contentChanged) {
        stats.descriptions!.contentChanged += 1;
      } else {
        stats.descriptions!.timestampOnly += 1;
      }
    } catch (err) {
      stats.descriptions!.failures += 1;
      console.error(
        `ensureSectionDescriptions: failed CRN ${crn} term ${termCode}`,
        err,
      );
    }
    await delay(FETCH_DELAY_MS);
  }

  stats.db.transactions += 1;
  stats.db.updates += await batchApplyDescriptionUpdates(
    db,
    termCode,
    pendingUpdates,
  );
  stats.banner = client.getBannerStats();
  return stats;
}

export async function loadSectionInformationByCrn(
  db: Database,
  termCode: string,
  crns: string[],
): Promise<Map<string, string | null>> {
  if (crns.length === 0) return new Map();
  const rows = await db
    .select({
      crn: schema.sections.crn,
      sectionInformationText: schema.sections.sectionInformationText,
    })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.termCode, termCode),
        inArray(schema.sections.crn, crns),
      ),
    );
  const map = new Map<string, string | null>();
  for (const r of rows) {
    map.set(r.crn, r.sectionInformationText);
  }
  return map;
}
