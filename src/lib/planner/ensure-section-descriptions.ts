import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { BannerSsbClient } from "@/lib/banner-ssb/client";
import { parseCourseDescriptionHtml } from "@/lib/banner-ssb/parse-course-description";
import { and, eq, inArray, isNull } from "drizzle-orm";

const FETCH_DELAY_MS = 150;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch Banner course/section descriptions for CRNs missing from the DB cache.
 * Best-effort: failures for individual CRNs are logged and skipped.
 */
export async function ensureSectionDescriptions(
  db: Database,
  termCode: string,
  crns: string[],
): Promise<void> {
  if (crns.length === 0) return;

  const rows = await db
    .select({
      crn: schema.sections.crn,
      descriptionsFetchedAt: schema.sections.descriptionsFetchedAt,
    })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.termCode, termCode),
        inArray(schema.sections.crn, crns),
        isNull(schema.sections.descriptionsFetchedAt),
      ),
    );

  if (rows.length === 0) return;

  const origin = requireEnv("BANNER_ORIGIN");
  const client = new BannerSsbClient(origin);
  await client.warmTermSelection();
  await client.selectTermAndLoadClassSearch(termCode);

  for (const { crn } of rows) {
    try {
      const html = await client.getCourseDescriptionHtml(termCode, crn);
      const parsed = parseCourseDescriptionHtml(html);
      await db
        .update(schema.sections)
        .set({
          courseDescription: parsed.courseDescription,
          sectionInformationText: parsed.sectionInformationText,
          descriptionsFetchedAt: new Date(),
        })
        .where(
          and(
            eq(schema.sections.termCode, termCode),
            eq(schema.sections.crn, crn),
          ),
        );
    } catch (err) {
      console.error(
        `ensureSectionDescriptions: failed CRN ${crn} term ${termCode}`,
        err,
      );
    }
    await delay(FETCH_DELAY_MS);
  }
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
