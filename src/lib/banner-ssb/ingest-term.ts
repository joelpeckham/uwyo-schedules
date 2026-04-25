import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import type { ParsedLinkedBundle } from "./mappers";
import type { SectionGraph } from "./mappers";

const BATCH = 250;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Replace all catalog rows for a term (full re-ingest). Caller supplies merged section graphs + linked bundles.
 */
export async function replaceTermData(
  db: Database,
  params: {
    termCode: string;
    termDescription: string;
    graphs: SectionGraph[];
    linkedBundles: ParsedLinkedBundle[];
    hotRun: boolean;
  },
): Promise<void> {
  const { termCode, termDescription, graphs, linkedBundles, hotRun } = params;

  const courseRows = new Map<
    string,
    typeof schema.courses.$inferInsert
  >();
  for (const g of graphs) {
    const k = `${g.section.subject}\0${g.section.courseNumber}`;
    if (!courseRows.has(k)) {
      courseRows.set(k, {
        termCode,
        subject: g.section.subject,
        courseNumber: g.section.courseNumber,
        subjectCourse: g.section.subjectCourse,
      });
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.linkedBundles)
      .where(eq(schema.linkedBundles.termCode, termCode));
    await tx
      .delete(schema.sectionAttributes)
      .where(eq(schema.sectionAttributes.termCode, termCode));
    await tx
      .delete(schema.sectionFaculty)
      .where(eq(schema.sectionFaculty.termCode, termCode));
    await tx
      .delete(schema.sectionMeetings)
      .where(eq(schema.sectionMeetings.termCode, termCode));
    await tx.delete(schema.sections).where(eq(schema.sections.termCode, termCode));
    await tx.delete(schema.courses).where(eq(schema.courses.termCode, termCode));

    await tx
      .insert(schema.terms)
      .values({
        code: termCode,
        description: termDescription,
        lastHotScrapeAt: hotRun ? new Date() : null,
        lastFullScrapeAt: hotRun ? null : new Date(),
      })
      .onConflictDoUpdate({
        target: schema.terms.code,
        set: {
          description: termDescription,
          lastHotScrapeAt: hotRun
            ? new Date()
            : sql`terms.last_hot_scrape_at`,
          lastFullScrapeAt: hotRun
            ? sql`terms.last_full_scrape_at`
            : new Date(),
        },
      });

    const coursesList = [...courseRows.values()];
    for (const part of chunk(coursesList, BATCH)) {
      if (part.length) await tx.insert(schema.courses).values(part);
    }

    for (const part of chunk(graphs, BATCH)) {
      if (!part.length) continue;
      await tx.insert(schema.sections).values(part.map((g) => g.section));
    }

    const meetings = graphs.flatMap((g) => g.meetings);
    for (const part of chunk(meetings, BATCH)) {
      if (part.length) await tx.insert(schema.sectionMeetings).values(part);
    }

    const faculty = graphs.flatMap((g) => g.faculty);
    for (const part of chunk(faculty, BATCH)) {
      if (part.length) await tx.insert(schema.sectionFaculty).values(part);
    }

    const attrs = graphs.flatMap((g) => g.attributes);
    for (const part of chunk(attrs, BATCH)) {
      if (part.length) await tx.insert(schema.sectionAttributes).values(part);
    }

    for (const b of linkedBundles) {
      const [ins] = await tx
        .insert(schema.linkedBundles)
        .values({
          termCode,
          anchorCrn: b.anchorCrn,
          bundleIndex: b.bundleIndex,
        })
        .returning({ id: schema.linkedBundles.id });
      if (!ins) continue;
      const members = b.memberCrns.map((crn, position) => ({
        bundleId: ins.id,
        crn,
        position,
      }));
      for (const part of chunk(members, BATCH)) {
        if (part.length) await tx.insert(schema.linkedBundleMembers).values(part);
      }
    }
  });
}
