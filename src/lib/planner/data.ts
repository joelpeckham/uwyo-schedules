import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { canonicalAggregateCourseTitle } from "@/lib/catalog/canonicalCourseTitleSql";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { decodeHtmlEntities } from "@/lib/text/decodeHtmlEntities";
import { escapeIlikePattern } from "./search-escape";

export type TermOption = { code: string; description: string };

/** One catalog course row from [`searchCourses`]. */
export type CourseSearchRow = {
  termCode: string;
  subject: string;
  courseNumber: string;
  subjectCourse: string | null;
  previewTitle: string | null;
};

export type PlannerItemRow = typeof schema.plannerItems.$inferSelect;

export type CalendarBlock = {
  key: string;
  plannerItemId: number;
  sectionCrn: string;
  meetingId: number;
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
  label: string;
  /** Building / room (after instructor when space allows). */
  sublabel: string;
  /** Comma-separated faculty names from Banner, if any. */
  instructorSublabel: string | null;
  color: string;
  subject: string;
  courseNumber: string;
  /** Normalized `sections.scheduleTypeDescription` for swap matching. */
  sectionScheduleTypeKey: string;
  /** Raw Banner `meetingScheduleType` on this meeting row (nullable). */
  meetingScheduleType: string | null;
};

/** One clipped meeting rectangle for same-type swap ghosts (other sections). */
export type SwapGhostMeeting = {
  crn: string;
  meetingId: number;
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
};

/** Stable key for RSC/client swap-ghost prefetch maps. */
export function swapPrefetchKey(
  plannerItemId: number,
  sectionCrn: string,
  meetingId: number,
): string {
  return `${plannerItemId}:${sectionCrn}:${meetingId}`;
}

export async function getLatestTermCode(db: Database): Promise<string | null> {
  const [row] = await db
    .select({ code: schema.terms.code })
    .from(schema.terms)
    .orderBy(desc(schema.terms.code))
    .limit(1);
  return row?.code ?? null;
}

export async function listTerms(db: Database): Promise<TermOption[]> {
  const rows = await db
    .select({
      code: schema.terms.code,
      description: schema.terms.description,
    })
    .from(schema.terms)
    .orderBy(desc(schema.terms.code));
  return rows.map((t) => ({
    code: t.code,
    description: decodeHtmlEntities(t.description) ?? t.description,
  }));
}

export async function listPlannerItems(
  db: Database,
  sessionId: string,
  termCode: string,
): Promise<PlannerItemRow[]> {
  return db
    .select()
    .from(schema.plannerItems)
    .where(
      and(
        eq(schema.plannerItems.sessionId, sessionId),
        eq(schema.plannerItems.termCode, termCode),
      ),
    )
    .orderBy(asc(schema.plannerItems.id));
}

const MAX_COURSE_SEARCH_QUERY_LEN = 200;

export async function searchCourses(
  db: Database,
  termCode: string,
  query: string,
  limit = 24,
): Promise<CourseSearchRow[]> {
  const q = query.trim().slice(0, MAX_COURSE_SEARCH_QUERY_LEN);
  if (q.length < 2) return [];
  const pattern = `%${escapeIlikePattern(q)}%`;

  /** `ESCAPE '\\'` so `%`, `_`, and `\` in user input are literal after `escapeIlikePattern`. */
  const textMatch = sql`(
    coalesce(${schema.courses.subjectCourse}, '') ilike ${pattern} escape '\\'
    or coalesce(${schema.courses.subject}, '') ilike ${pattern} escape '\\'
    or coalesce(${schema.courses.courseNumber}, '') ilike ${pattern} escape '\\'
    or coalesce(${schema.sections.courseTitle}, '') ilike ${pattern} escape '\\'
    or coalesce(${schema.sections.subjectDescription}, '') ilike ${pattern} escape '\\'
    or coalesce(${schema.sections.scheduleTypeDescription}, '') ilike ${pattern} escape '\\'
    or coalesce(${schema.sections.crn}, '') ilike ${pattern} escape '\\'
    or coalesce(${schema.sections.instructionalMethodDescription}, '') ilike ${pattern} escape '\\'
    or coalesce(${schema.sections.partOfTerm}, '') ilike ${pattern} escape '\\'
    or coalesce(${schema.sections.campusDescription}, '') ilike ${pattern} escape '\\'
  )`;

  const rows = await db
    .select({
      termCode: schema.courses.termCode,
      subject: schema.courses.subject,
      courseNumber: schema.courses.courseNumber,
      subjectCourse: schema.courses.subjectCourse,
      previewTitle: canonicalAggregateCourseTitle(),
    })
    .from(schema.courses)
    .innerJoin(
      schema.sections,
      and(
        eq(schema.sections.termCode, schema.courses.termCode),
        eq(schema.sections.subject, schema.courses.subject),
        eq(schema.sections.courseNumber, schema.courses.courseNumber),
      ),
    )
    .where(and(eq(schema.courses.termCode, termCode), textMatch))
    .groupBy(
      schema.courses.termCode,
      schema.courses.subject,
      schema.courses.courseNumber,
      schema.courses.subjectCourse,
    )
    .orderBy(schema.courses.subject, schema.courses.courseNumber)
    .limit(limit);
  return rows.map((r) => ({
    termCode: r.termCode,
    subject: r.subject,
    courseNumber: r.courseNumber,
    subjectCourse: decodeHtmlEntities(r.subjectCourse),
    previewTitle: decodeHtmlEntities(r.previewTitle),
  }));
}

export async function listSectionsForCourse(
  db: Database,
  termCode: string,
  subject: string,
  courseNumber: string,
) {
  const raw = await db
    .select({
      crn: schema.sections.crn,
      sequenceNumber: schema.sections.sequenceNumber,
      courseTitle: schema.sections.courseTitle,
      scheduleTypeDescription: schema.sections.scheduleTypeDescription,
      subjectCourse: schema.sections.subjectCourse,
      isSectionLinked: schema.sections.isSectionLinked,
    })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.termCode, termCode),
        eq(schema.sections.subject, subject),
        eq(schema.sections.courseNumber, courseNumber),
      ),
    )
    .orderBy(schema.sections.crn);
  return raw.map((r) => ({
    crn: r.crn,
    sequenceNumber: decodeHtmlEntities(r.sequenceNumber),
    courseTitle: decodeHtmlEntities(r.courseTitle),
    scheduleTypeDescription: decodeHtmlEntities(r.scheduleTypeDescription),
    subjectCourse: decodeHtmlEntities(r.subjectCourse),
    isSectionLinked: r.isSectionLinked,
  }));
}

export type LinkedBundleOption = {
  id: number;
  bundleIndex: number;
  memberCrns: string[];
  summary: string;
};

/**
 * Loads linked-bundle registration options for many anchor CRNs in three queries
 * (bundles, members, section labels) instead of one round-trip per anchor.
 */
export async function listLinkedBundleOptionsForAnchors(
  db: Database,
  termCode: string,
  anchorCrns: string[],
): Promise<Map<string, LinkedBundleOption[]>> {
  const out = new Map<string, LinkedBundleOption[]>();
  const deduped = [...new Set(anchorCrns.filter(Boolean))];
  if (deduped.length === 0) return out;

  const bundles = await db
    .select({
      id: schema.linkedBundles.id,
      anchorCrn: schema.linkedBundles.anchorCrn,
      bundleIndex: schema.linkedBundles.bundleIndex,
    })
    .from(schema.linkedBundles)
    .where(
      and(
        eq(schema.linkedBundles.termCode, termCode),
        inArray(schema.linkedBundles.anchorCrn, deduped),
      ),
    )
    .orderBy(
      asc(schema.linkedBundles.anchorCrn),
      asc(schema.linkedBundles.bundleIndex),
    );

  if (bundles.length === 0) return out;

  const bundleIds = bundles.map((b) => b.id);
  const members = await db
    .select({
      bundleId: schema.linkedBundleMembers.bundleId,
      crn: schema.linkedBundleMembers.crn,
      position: schema.linkedBundleMembers.position,
    })
    .from(schema.linkedBundleMembers)
    .where(inArray(schema.linkedBundleMembers.bundleId, bundleIds))
    .orderBy(
      schema.linkedBundleMembers.bundleId,
      asc(schema.linkedBundleMembers.position),
    );

  const byBundle = new Map<number, { crn: string; position: number }[]>();
  for (const m of members) {
    const list = byBundle.get(m.bundleId) ?? [];
    list.push({ crn: m.crn, position: m.position });
    byBundle.set(m.bundleId, list);
  }

  const allCrns = [...new Set(members.map((m) => m.crn))];
  const sectionLabels =
    allCrns.length === 0
      ? new Map<string, string>()
      : await loadSectionLabels(db, termCode, allCrns);

  for (const b of bundles) {
    const list = (byBundle.get(b.id) ?? []).sort((a, c) => a.position - c.position);
    const memberCrns = list.map((x) => x.crn);
    const parts = memberCrns.map(
      (crn) => sectionLabels.get(crn) ?? `CRN ${crn}`,
    );
    const summary =
      parts.length > 0
        ? parts.join(" · ")
        : `Option ${b.bundleIndex + 1}`;
    const opt: LinkedBundleOption = {
      id: b.id,
      bundleIndex: b.bundleIndex,
      memberCrns,
      summary,
    };
    const arr = out.get(b.anchorCrn) ?? [];
    arr.push(opt);
    out.set(b.anchorCrn, arr);
  }

  return out;
}

export async function listLinkedBundleOptions(
  db: Database,
  termCode: string,
  anchorCrn: string,
): Promise<LinkedBundleOption[]> {
  const byAnchor = await listLinkedBundleOptionsForAnchors(db, termCode, [
    anchorCrn,
  ]);
  return byAnchor.get(anchorCrn) ?? [];
}

async function loadSectionLabels(
  db: Database,
  termCode: string,
  crns: string[],
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      crn: schema.sections.crn,
      scheduleTypeDescription: schema.sections.scheduleTypeDescription,
      sequenceNumber: schema.sections.sequenceNumber,
      subjectCourse: schema.sections.subjectCourse,
    })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.termCode, termCode),
        inArray(schema.sections.crn, crns),
      ),
    );
  const map = new Map<string, string>();
  for (const r of rows) {
    const code = decodeHtmlEntities(r.subjectCourse) ?? r.subjectCourse ?? "";
    const seq = r.sequenceNumber
      ? ` #${decodeHtmlEntities(r.sequenceNumber) ?? r.sequenceNumber}`
      : "";
    const st = decodeHtmlEntities(r.scheduleTypeDescription) ?? r.scheduleTypeDescription ?? "";
    map.set(
      r.crn,
      [code + seq, st].filter(Boolean).join(" — ") || `CRN ${r.crn}`,
    );
  }
  return map;
}

export async function getSectionDetail(
  db: Database,
  termCode: string,
  crn: string,
) {
  const [row] = await db
    .select({
      rawJson: schema.sections.rawJson,
      subject: schema.sections.subject,
      courseNumber: schema.sections.courseNumber,
      sequenceNumber: schema.sections.sequenceNumber,
      courseTitle: schema.sections.courseTitle,
      subjectCourse: schema.sections.subjectCourse,
      scheduleTypeDescription: schema.sections.scheduleTypeDescription,
    })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.termCode, termCode),
        eq(schema.sections.crn, crn),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    sequenceNumber: decodeHtmlEntities(row.sequenceNumber),
    courseTitle: decodeHtmlEntities(row.courseTitle),
    subjectCourse: decodeHtmlEntities(row.subjectCourse),
    scheduleTypeDescription: decodeHtmlEntities(row.scheduleTypeDescription),
  };
}
