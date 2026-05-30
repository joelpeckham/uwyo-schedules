import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import {
  SEO_SITEMAP_TAG,
  seoCourseTag,
  seoTermSubjectTag,
  seoTermTag,
} from "@/lib/seo/cache-tags";
import {
  computeSectionContentHash,
  extractSectionSeatSnapshot,
  sectionSeatsEqual,
  type ParsedLinkedBundle,
  type SectionGraph,
  type SectionSeatSnapshot,
} from "./mappers";
import {
  emptyDbStats,
  type DbCallStats,
  type SectionSyncStats,
} from "@/lib/ingest/stats";

const BATCH = 250;

type ExistingSectionRow = {
  crn: string;
  contentHash: string | null;
  seats: SectionSeatSnapshot;
};

type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function deleteSectionChildrenForCrns(
  tx: DbTransaction,
  termCode: string,
  crns: string[],
  dbStats: DbCallStats,
): Promise<void> {
  if (crns.length === 0) return;
  for (const part of chunk(crns, BATCH)) {
    dbStats.deletes += 1;
    await tx
      .delete(schema.sectionAttributes)
      .where(
        and(
          eq(schema.sectionAttributes.termCode, termCode),
          inArray(schema.sectionAttributes.sectionCrn, part),
        ),
      );
    dbStats.deletes += 1;
    await tx
      .delete(schema.sectionFaculty)
      .where(
        and(
          eq(schema.sectionFaculty.termCode, termCode),
          inArray(schema.sectionFaculty.sectionCrn, part),
        ),
      );
    dbStats.deletes += 1;
    await tx
      .delete(schema.sectionMeetings)
      .where(
        and(
          eq(schema.sectionMeetings.termCode, termCode),
          inArray(schema.sectionMeetings.sectionCrn, part),
        ),
      );
  }
}

async function deleteSectionsForCrns(
  tx: DbTransaction,
  termCode: string,
  crns: string[],
  dbStats: DbCallStats,
): Promise<void> {
  if (crns.length === 0) return;
  for (const part of chunk(crns, BATCH)) {
    dbStats.deletes += 1;
    await tx
      .delete(schema.sections)
      .where(
        and(
          eq(schema.sections.termCode, termCode),
          inArray(schema.sections.crn, part),
        ),
      );
  }
}

async function insertSectionChildren(
  tx: DbTransaction,
  graphs: SectionGraph[],
  dbStats: DbCallStats,
): Promise<void> {
  const meetings = graphs.flatMap((g) => g.meetings);
  for (const part of chunk(meetings, BATCH)) {
    if (part.length) {
      dbStats.inserts += 1;
      await tx.insert(schema.sectionMeetings).values(part);
    }
  }

  const faculty = graphs.flatMap((g) => g.faculty);
  for (const part of chunk(faculty, BATCH)) {
    if (part.length) {
      dbStats.inserts += 1;
      await tx.insert(schema.sectionFaculty).values(part);
    }
  }

  const attrs = graphs.flatMap((g) => g.attributes);
  for (const part of chunk(attrs, BATCH)) {
    if (part.length) {
      dbStats.inserts += 1;
      await tx.insert(schema.sectionAttributes).values(part);
    }
  }
}

async function insertSectionGraphs(
  tx: DbTransaction,
  graphs: SectionGraph[],
  dbStats: DbCallStats,
): Promise<void> {
  for (const part of chunk(graphs, BATCH)) {
    if (!part.length) continue;
    dbStats.inserts += 1;
    await tx
      .insert(schema.sections)
      .values(part.map((g) => g.section));
    await insertSectionChildren(tx, part, dbStats);
  }
}

function sectionContentUpdateValues(
  graph: SectionGraph,
): Omit<
  typeof schema.sections.$inferInsert,
  "courseDescription" | "sectionInformationText" | "descriptionsFetchedAt"
> {
  const { section } = graph;
  return {
    termCode: section.termCode,
    crn: section.crn,
    subject: section.subject,
    courseNumber: section.courseNumber,
    sequenceNumber: section.sequenceNumber,
    subjectDescription: section.subjectDescription,
    courseTitle: section.courseTitle,
    subjectCourse: section.subjectCourse,
    scheduleTypeDescription: section.scheduleTypeDescription,
    partOfTerm: section.partOfTerm,
    campusDescription: section.campusDescription,
    instructionalMethod: section.instructionalMethod,
    instructionalMethodDescription: section.instructionalMethodDescription,
    creditHours: section.creditHours,
    creditHourHigh: section.creditHourHigh,
    creditHourLow: section.creditHourLow,
    creditHourIndicator: section.creditHourIndicator,
    enrollment: section.enrollment,
    maximumEnrollment: section.maximumEnrollment,
    seatsAvailable: section.seatsAvailable,
    waitCapacity: section.waitCapacity,
    waitCount: section.waitCount,
    waitAvailable: section.waitAvailable,
    openSection: section.openSection,
    crossList: section.crossList,
    crossListCapacity: section.crossListCapacity,
    crossListCount: section.crossListCount,
    crossListAvailable: section.crossListAvailable,
    linkIdentifier: section.linkIdentifier,
    isSectionLinked: section.isSectionLinked,
    bannerRowId: section.bannerRowId,
    contentHash: section.contentHash,
    rawJson: section.rawJson,
    updatedAt: new Date(),
  };
}

type SyncTermPartition = {
  insert: SectionGraph[];
  seatOnly: SectionGraph[];
  contentChanged: SectionGraph[];
  removeCrns: string[];
};

/** Partition scraped graphs against existing DB rows for diff-based sync. */
export function partitionTermGraphs(
  graphs: SectionGraph[],
  existingByCrn: Map<string, ExistingSectionRow>,
): SyncTermPartition {
  const insert: SectionGraph[] = [];
  const seatOnly: SectionGraph[] = [];
  const contentChanged: SectionGraph[] = [];
  const scrapedCrns = new Set<string>();

  for (const graph of graphs) {
    const hash = computeSectionContentHash(graph);
    graph.section.contentHash = hash;
    scrapedCrns.add(graph.section.crn);

    const existing = existingByCrn.get(graph.section.crn);
    if (!existing) {
      insert.push(graph);
      continue;
    }

    const incomingSeats = extractSectionSeatSnapshot(graph.section);
    if (
      existing.contentHash === hash &&
      sectionSeatsEqual(existing.seats, incomingSeats)
    ) {
      continue;
    }

    if (existing.contentHash === hash) {
      seatOnly.push(graph);
    } else {
      contentChanged.push(graph);
    }
  }

  const removeCrns: string[] = [];
  for (const crn of existingByCrn.keys()) {
    if (!scrapedCrns.has(crn)) removeCrns.push(crn);
  }

  return { insert, seatOnly, contentChanged, removeCrns };
}

/**
 * Diff-based catalog sync for a term. Updates only changed sections instead of
 * full delete-and-reinsert. Caller supplies merged section graphs + linked bundles.
 */
export async function syncTermData(
  db: Database,
  params: {
    termCode: string;
    termDescription: string;
    graphs: SectionGraph[];
    linkedBundles: ParsedLinkedBundle[];
    hotRun: boolean;
  },
): Promise<{ changed: boolean; sectionSync: SectionSyncStats; db: DbCallStats }> {
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

  let changed = false;
  const dbStats = emptyDbStats();
  dbStats.transactions = 1;
  let partition: SyncTermPartition = {
    insert: [],
    seatOnly: [],
    contentChanged: [],
    removeCrns: [],
  };

  await db.transaction(async (tx) => {
    dbStats.selects += 1;
    const existingRows = await tx
      .select({
        crn: schema.sections.crn,
        contentHash: schema.sections.contentHash,
        enrollment: schema.sections.enrollment,
        maximumEnrollment: schema.sections.maximumEnrollment,
        seatsAvailable: schema.sections.seatsAvailable,
        waitCapacity: schema.sections.waitCapacity,
        waitCount: schema.sections.waitCount,
        waitAvailable: schema.sections.waitAvailable,
        openSection: schema.sections.openSection,
        crossListCapacity: schema.sections.crossListCapacity,
        crossListCount: schema.sections.crossListCount,
        crossListAvailable: schema.sections.crossListAvailable,
        rawJson: schema.sections.rawJson,
      })
      .from(schema.sections)
      .where(eq(schema.sections.termCode, termCode));

    const existingByCrn = new Map<string, ExistingSectionRow>();
    for (const row of existingRows) {
      existingByCrn.set(row.crn, {
        crn: row.crn,
        contentHash: row.contentHash,
        seats: {
          enrollment: row.enrollment,
          maximumEnrollment: row.maximumEnrollment,
          seatsAvailable: row.seatsAvailable,
          waitCapacity: row.waitCapacity,
          waitCount: row.waitCount,
          waitAvailable: row.waitAvailable,
          openSection: row.openSection,
          crossListCapacity: row.crossListCapacity,
          crossListCount: row.crossListCount,
          crossListAvailable: row.crossListAvailable,
          rawJson: row.rawJson,
        },
      });
    }

    const partitioned = partitionTermGraphs(graphs, existingByCrn);
    partition = partitioned;
    const { insert, seatOnly, contentChanged, removeCrns } = partitioned;

    if (
      insert.length > 0 ||
      seatOnly.length > 0 ||
      contentChanged.length > 0 ||
      removeCrns.length > 0
    ) {
      changed = true;
    }

    dbStats.inserts += 1;
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
    if (coursesList.length > 0) {
      for (const part of chunk(coursesList, BATCH)) {
        dbStats.inserts += 1;
        await tx
          .insert(schema.courses)
          .values(part)
          .onConflictDoNothing();
      }
    }

    if (removeCrns.length > 0) {
      await deleteSectionChildrenForCrns(tx, termCode, removeCrns, dbStats);
      await deleteSectionsForCrns(tx, termCode, removeCrns, dbStats);
    }

    if (insert.length > 0) {
      await insertSectionGraphs(tx, insert, dbStats);
    }

    for (const graph of seatOnly) {
      const seats = extractSectionSeatSnapshot(graph.section);
      dbStats.updates += 1;
      await tx
        .update(schema.sections)
        .set({
          ...seats,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.sections.termCode, termCode),
            eq(schema.sections.crn, graph.section.crn),
          ),
        );
    }

    if (contentChanged.length > 0) {
      const contentCrns = contentChanged.map((g) => g.section.crn);
      await deleteSectionChildrenForCrns(tx, termCode, contentCrns, dbStats);

      for (const graph of contentChanged) {
        dbStats.updates += 1;
        await tx
          .update(schema.sections)
          .set(sectionContentUpdateValues(graph))
          .where(
            and(
              eq(schema.sections.termCode, termCode),
              eq(schema.sections.crn, graph.section.crn),
            ),
          );
      }

      await insertSectionChildren(tx, contentChanged, dbStats);
    }

    const activeCourseKeys = new Set(courseRows.keys());
    dbStats.selects += 1;
    const existingCourses = await tx
      .select({
        subject: schema.courses.subject,
        courseNumber: schema.courses.courseNumber,
      })
      .from(schema.courses)
      .where(eq(schema.courses.termCode, termCode));
    const orphanCourses = existingCourses.filter(
      (c) => !activeCourseKeys.has(`${c.subject}\0${c.courseNumber}`),
    );
    if (orphanCourses.length > 0) {
      changed = true;
      for (const c of orphanCourses) {
        dbStats.deletes += 1;
        await tx
          .delete(schema.courses)
          .where(
            and(
              eq(schema.courses.termCode, termCode),
              eq(schema.courses.subject, c.subject),
              eq(schema.courses.courseNumber, c.courseNumber),
            ),
          );
      }
    }

    dbStats.selects += 1;
    const existingBundles = await tx
      .select({
        id: schema.linkedBundles.id,
        anchorCrn: schema.linkedBundles.anchorCrn,
        bundleIndex: schema.linkedBundles.bundleIndex,
      })
      .from(schema.linkedBundles)
      .where(eq(schema.linkedBundles.termCode, termCode));

    const existingByKey = new Map<string, number>();
    for (const r of existingBundles) {
      existingByKey.set(`${r.anchorCrn}\0${r.bundleIndex}`, r.id);
    }

    const retainedBundleIds: number[] = [];
    const reusedBundles: { id: number; bundle: ParsedLinkedBundle }[] = [];
    const newBundlesToInsert: ParsedLinkedBundle[] = [];
    for (const b of linkedBundles) {
      const key = `${b.anchorCrn}\0${b.bundleIndex}`;
      const existingId = existingByKey.get(key);
      if (existingId != null) {
        retainedBundleIds.push(existingId);
        reusedBundles.push({ id: existingId, bundle: b });
      } else {
        newBundlesToInsert.push(b);
      }
    }

    if (newBundlesToInsert.length > 0) {
      changed = true;
    }

    if (retainedBundleIds.length > 0) {
      for (const part of chunk(retainedBundleIds, BATCH)) {
        dbStats.deletes += 1;
        await tx
          .delete(schema.linkedBundleMembers)
          .where(inArray(schema.linkedBundleMembers.bundleId, part));
      }
    }

    const newBundleIdByKey = new Map<string, number>();
    if (newBundlesToInsert.length > 0) {
      for (const part of chunk(newBundlesToInsert, BATCH)) {
        dbStats.inserts += 1;
        const inserted = await tx
          .insert(schema.linkedBundles)
          .values(
            part.map((b) => ({
              termCode,
              anchorCrn: b.anchorCrn,
              bundleIndex: b.bundleIndex,
            })),
          )
          .returning({
            id: schema.linkedBundles.id,
            anchorCrn: schema.linkedBundles.anchorCrn,
            bundleIndex: schema.linkedBundles.bundleIndex,
          });
        if (inserted.length !== part.length) {
          throw new Error(
            `Linked bundle insert returned ${inserted.length} rows for ${part.length} requested in termCode=${termCode}`,
          );
        }
        for (const r of inserted) {
          newBundleIdByKey.set(`${r.anchorCrn}\0${r.bundleIndex}`, r.id);
          retainedBundleIds.push(r.id);
        }
      }
    }

    const allMemberRows: { bundleId: number; crn: string; position: number }[] =
      [];
    for (const { id, bundle } of reusedBundles) {
      bundle.memberCrns.forEach((crn, position) => {
        allMemberRows.push({ bundleId: id, crn, position });
      });
    }
    for (const b of newBundlesToInsert) {
      const id = newBundleIdByKey.get(`${b.anchorCrn}\0${b.bundleIndex}`);
      if (id == null) {
        throw new Error(
          `New bundle id missing after insert for termCode=${termCode} anchorCrn=${b.anchorCrn} bundleIndex=${b.bundleIndex}`,
        );
      }
      b.memberCrns.forEach((crn, position) => {
        allMemberRows.push({ bundleId: id, crn, position });
      });
    }
    for (const part of chunk(allMemberRows, BATCH)) {
      if (part.length) {
        dbStats.inserts += 1;
        await tx.insert(schema.linkedBundleMembers).values(part);
      }
    }

    if (retainedBundleIds.length === 0) {
      if (existingBundles.length > 0) changed = true;
      dbStats.deletes += 1;
      await tx
        .delete(schema.linkedBundles)
        .where(eq(schema.linkedBundles.termCode, termCode));
    } else {
      dbStats.deletes += 1;
      await tx
        .delete(schema.linkedBundles)
        .where(
          and(
            eq(schema.linkedBundles.termCode, termCode),
            notInArray(schema.linkedBundles.id, retainedBundleIds),
          ),
        );
    }
  });

  const sectionSync: SectionSyncStats = {
    scraped: graphs.length,
    unchanged:
      graphs.length -
      partition.insert.length -
      partition.seatOnly.length -
      partition.contentChanged.length,
    inserted: partition.insert.length,
    seatOnlyUpdates: partition.seatOnly.length,
    contentChanged: partition.contentChanged.length,
    removed: partition.removeCrns.length,
    catalogChanged: changed,
  };

  if (!changed) {
    return { changed: false, sectionSync, db: dbStats };
  }

  const subjectsTouched = new Set<string>();
  const coursesTouched = new Map<
    string,
    { subject: string; courseNumber: string }
  >();
  for (const g of graphs) {
    subjectsTouched.add(g.section.subject);
    const subject = g.section.subject;
    const courseNumber = g.section.courseNumber;
    const id = `${subject}\u0000${courseNumber}`;
    if (!coursesTouched.has(id)) {
      coursesTouched.set(id, { subject, courseNumber });
    }
  }
  revalidateTag(seoTermTag(termCode), "max");
  revalidateTag(SEO_SITEMAP_TAG, "max");
  for (const subject of subjectsTouched) {
    revalidateTag(seoTermSubjectTag(termCode, subject), "max");
  }
  for (const { subject, courseNumber } of coursesTouched.values()) {
    revalidateTag(seoCourseTag(subject, courseNumber), "max");
  }

  return { changed: true, sectionSync, db: dbStats };
}
