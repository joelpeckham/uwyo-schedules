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

    /**
     * Linked-bundle reconciliation in O(1) round-trips per category instead
     * of one select-then-mutate cycle per bundle. We:
     *   1. Bulk-select all existing bundles for the term.
     *   2. Bulk-delete members for retained bundles in one statement.
     *   3. Bulk-insert any new bundles, returning their ids.
     *   4. Bulk-insert all members across every retained + new bundle.
     *   5. Bulk-delete stale bundles (those not seen this ingest).
     *
     * Preserves `linked_bundles.id` across ingests so existing
     * `planner_items.linked_bundle_id` references stay valid.
     */
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

    // Wipe member rows for every retained bundle in one statement instead of
    // one delete per bundle.
    if (retainedBundleIds.length > 0) {
      for (const part of chunk(retainedBundleIds, BATCH)) {
        await tx
          .delete(schema.linkedBundleMembers)
          .where(inArray(schema.linkedBundleMembers.bundleId, part));
      }
    }

    const newBundleIdByKey = new Map<string, number>();
    if (newBundlesToInsert.length > 0) {
      for (const part of chunk(newBundlesToInsert, BATCH)) {
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

    const allMemberRows: { bundleId: number; crn: string; position: number }[] = [];
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
      if (part.length) await tx.insert(schema.linkedBundleMembers).values(part);
    }

    if (retainedBundleIds.length === 0) {
      await tx
        .delete(schema.linkedBundles)
        .where(eq(schema.linkedBundles.termCode, termCode));
    } else {
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

  // After the transaction commits, invalidate the cached SEO surfaces tied
  // to this term so the next request re-queries Postgres. We use the broad
  // term tag plus per-(subject, courseNumber) tags so tightly-scoped course
  // pages don't have to wait for the next `revalidate` window.
  const subjectsTouched = new Set<string>();
  // Use a Map keyed by an internal string id to dedupe (subject, courseNumber)
  // tuples without resorting to a delimiter-encoded key. Storing the tuple
  // directly avoids subtle bugs if a subject or course number ever contained
  // the previous `\0` delimiter (and makes the type explicit).
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
  // `"max"` keeps stale-while-revalidate semantics — readers see the previous
  // catalog snapshot until the new query lands instead of blocking on a cold
  // re-fetch the moment the scrape finishes.
  revalidateTag(seoTermTag(termCode), "max");
  revalidateTag(SEO_SITEMAP_TAG, "max");
  for (const subject of subjectsTouched) {
    revalidateTag(seoTermSubjectTag(termCode, subject), "max");
  }
  for (const { subject, courseNumber } of coursesTouched.values()) {
    revalidateTag(seoCourseTag(subject, courseNumber), "max");
  }
}
