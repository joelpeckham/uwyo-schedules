import { createDb } from "@/db/index";
import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, max, sql } from "drizzle-orm";

/** URL path segment for Banner subject (e.g. `MATH` → `math`). */
export function subjectToPathSegment(subject: string): string {
  return subject.trim().toLowerCase();
}

/** Canonical Banner subject for lookups from a path segment. */
export function pathSegmentToSubject(segment: string): string {
  return segment.trim().toUpperCase();
}

export type SubjectRow = {
  subject: string;
  sectionCount: number;
};

export async function listSubjectsForTerm(
  db: Database,
  termCode: string,
): Promise<SubjectRow[]> {
  const rows = await db
    .select({
      subject: schema.sections.subject,
      sectionCount: sql<number>`count(*)::int`,
    })
    .from(schema.sections)
    .where(eq(schema.sections.termCode, termCode))
    .groupBy(schema.sections.subject)
    .orderBy(asc(schema.sections.subject));
  return rows;
}

export type CourseListRow = {
  subject: string;
  courseNumber: string;
  subjectCourse: string | null;
  title: string | null;
  sectionCount: number;
  creditHours: number | null;
};

export async function listCoursesForSubjectAndTerm(
  db: Database,
  termCode: string,
  subject: string,
): Promise<CourseListRow[]> {
  const subj = subject.trim().toUpperCase();
  const rows = await db
    .select({
      subject: schema.courses.subject,
      courseNumber: schema.courses.courseNumber,
      subjectCourse: schema.courses.subjectCourse,
      title: max(schema.sections.courseTitle),
      sectionCount: sql<number>`count(distinct ${schema.sections.crn})::int`,
      creditHours: max(schema.sections.creditHours),
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
    .where(
      and(eq(schema.courses.termCode, termCode), eq(schema.courses.subject, subj)),
    )
    .groupBy(
      schema.courses.subject,
      schema.courses.courseNumber,
      schema.courses.subjectCourse,
    )
    .orderBy(asc(schema.courses.courseNumber));
  return rows.map((r) => ({
    subject: r.subject,
    courseNumber: r.courseNumber,
    subjectCourse: r.subjectCourse,
    title: r.title,
    sectionCount: r.sectionCount,
    creditHours: r.creditHours,
  }));
}

export type CourseTermSummary = {
  termCode: string;
  termDescription: string;
  sectionCount: number;
  lastUpdated: Date | null;
};

export type CourseSeoDetail = {
  subject: string;
  courseNumber: string;
  /** Best-known title across terms. */
  title: string | null;
  terms: CourseTermSummary[];
};

export async function getCourseSeoDetail(
  db: Database,
  subject: string,
  courseNumber: string,
): Promise<CourseSeoDetail | null> {
  const subj = subject.trim().toUpperCase();
  const num = courseNumber.trim();
  const exists = await db
    .select({ one: sql`1` })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.subject, subj),
        eq(schema.sections.courseNumber, num),
      ),
    )
    .limit(1);
  if (exists.length === 0) return null;

  const titleRow = await db
    .select({ title: max(schema.sections.courseTitle) })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.subject, subj),
        eq(schema.sections.courseNumber, num),
      ),
    );
  const title = titleRow[0]?.title ?? null;

  const termRows = await db
    .select({
      termCode: schema.sections.termCode,
      termDescription: schema.terms.description,
      sectionCount: sql<number>`count(distinct ${schema.sections.crn})::int`,
      lastUpdated: max(schema.sections.updatedAt),
    })
    .from(schema.sections)
    .innerJoin(schema.terms, eq(schema.terms.code, schema.sections.termCode))
    .where(
      and(
        eq(schema.sections.subject, subj),
        eq(schema.sections.courseNumber, num),
      ),
    )
    .groupBy(schema.sections.termCode, schema.terms.description)
    .orderBy(desc(schema.sections.termCode));

  return {
    subject: subj,
    courseNumber: num,
    title: title ?? termRows[0]?.termDescription ?? null,
    terms: termRows.map((t) => ({
      termCode: t.termCode,
      termDescription: t.termDescription,
      sectionCount: t.sectionCount,
      lastUpdated: t.lastUpdated,
    })),
  };
}

export type SectionTableRow = {
  crn: string;
  termCode: string;
  courseTitle: string | null;
  scheduleTypeDescription: string | null;
  seatsAvailable: number | null;
  enrollment: number | null;
  maximumEnrollment: number | null;
  facultyNames: string | null;
  meetingSummary: string | null;
};

function formatMeetingRow(m: typeof schema.sectionMeetings.$inferSelect): string {
  const days: string[] = [];
  if (m.monday) days.push("M");
  if (m.tuesday) days.push("T");
  if (m.wednesday) days.push("W");
  if (m.thursday) days.push("Th");
  if (m.friday) days.push("F");
  if (m.saturday) days.push("Sa");
  if (m.sunday) days.push("Su");
  const dayPart = days.length > 0 ? days.join("") : "—";
  const time =
    m.beginTime && m.endTime ? `${m.beginTime}–${m.endTime}` : "Time TBA";
  const place =
    m.building && m.room
      ? `${m.building} ${m.room}`
      : (m.buildingDescription ?? m.campusDescription ?? "");
  return [dayPart, time, place].filter(Boolean).join(" · ");
}

export async function listSectionTableRowsForCourseTerm(
  db: Database,
  termCode: string,
  subject: string,
  courseNumber: string,
): Promise<SectionTableRow[]> {
  const subj = subject.trim().toUpperCase();
  const num = courseNumber.trim();
  const sectionRows = await db
    .select({
      crn: schema.sections.crn,
      courseTitle: schema.sections.courseTitle,
      scheduleTypeDescription: schema.sections.scheduleTypeDescription,
      seatsAvailable: schema.sections.seatsAvailable,
      enrollment: schema.sections.enrollment,
      maximumEnrollment: schema.sections.maximumEnrollment,
    })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.termCode, termCode),
        eq(schema.sections.subject, subj),
        eq(schema.sections.courseNumber, num),
      ),
    )
    .orderBy(asc(schema.sections.crn));

  if (sectionRows.length === 0) return [];

  const crns = sectionRows.map((s) => s.crn);
  const meetings = await db
    .select()
    .from(schema.sectionMeetings)
    .where(
      and(
        eq(schema.sectionMeetings.termCode, termCode),
        inArray(schema.sectionMeetings.sectionCrn, crns),
      ),
    )
    .orderBy(
      schema.sectionMeetings.sectionCrn,
      asc(schema.sectionMeetings.sortOrder),
    );

  const faculty = await db
    .select({
      crn: schema.sectionFaculty.sectionCrn,
      name: schema.sectionFaculty.displayName,
      sort: schema.sectionFaculty.sortOrder,
    })
    .from(schema.sectionFaculty)
    .where(
      and(
        eq(schema.sectionFaculty.termCode, termCode),
        inArray(schema.sectionFaculty.sectionCrn, crns),
      ),
    )
    .orderBy(
      schema.sectionFaculty.sectionCrn,
      asc(schema.sectionFaculty.sortOrder),
    );

  const meetingsByCrn = new Map<string, typeof schema.sectionMeetings.$inferSelect[]>();
  for (const m of meetings) {
    const list = meetingsByCrn.get(m.sectionCrn) ?? [];
    list.push(m);
    meetingsByCrn.set(m.sectionCrn, list);
  }

  const facultyByCrn = new Map<string, string[]>();
  for (const f of faculty) {
    if (!f.name) continue;
    const list = facultyByCrn.get(f.crn) ?? [];
    list.push(f.name);
    facultyByCrn.set(f.crn, list);
  }

  return sectionRows.map((s) => {
    const ms = meetingsByCrn.get(s.crn) ?? [];
    const meetingSummary =
      ms.length > 0 ? ms.map(formatMeetingRow).join("; ") : null;
    const names = facultyByCrn.get(s.crn);
    return {
      crn: s.crn,
      termCode,
      courseTitle: s.courseTitle,
      scheduleTypeDescription: s.scheduleTypeDescription,
      seatsAvailable: s.seatsAvailable,
      enrollment: s.enrollment,
      maximumEnrollment: s.maximumEnrollment,
      facultyNames: names && names.length > 0 ? names.join(", ") : null,
      meetingSummary,
    };
  });
}

export function slugifyInstructorName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type InstructorIndexRow = {
  slug: string;
  displayName: string;
  sectionCount: number;
};

export async function listInstructorsForSeo(
  db: Database,
  minSections = 3,
): Promise<InstructorIndexRow[]> {
  const rows = await db
    .select({
      displayName: schema.sectionFaculty.displayName,
      sectionCount: count(),
    })
    .from(schema.sectionFaculty)
    .where(isNotNull(schema.sectionFaculty.displayName))
    .groupBy(schema.sectionFaculty.displayName)
    .having(gte(count(), minSections));

  const out: InstructorIndexRow[] = [];
  for (const r of rows) {
    const name = r.displayName?.trim();
    if (!name) continue;
    const slug = slugifyInstructorName(name);
    if (!slug) continue;
    out.push({ slug, displayName: name, sectionCount: r.sectionCount });
  }
  out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return out;
}

export async function listSectionsForInstructorDisplayName(
  db: Database,
  displayName: string,
  limit = 200,
) {
  const rows = await db
    .select({
      termCode: schema.sections.termCode,
      crn: schema.sections.crn,
      subject: schema.sections.subject,
      courseNumber: schema.sections.courseNumber,
      subjectCourse: schema.sections.subjectCourse,
      courseTitle: schema.sections.courseTitle,
      scheduleTypeDescription: schema.sections.scheduleTypeDescription,
    })
    .from(schema.sectionFaculty)
    .innerJoin(
      schema.sections,
      and(
        eq(schema.sections.termCode, schema.sectionFaculty.termCode),
        eq(schema.sections.crn, schema.sectionFaculty.sectionCrn),
      ),
    )
    .where(eq(schema.sectionFaculty.displayName, displayName))
    .orderBy(desc(schema.sections.termCode), asc(schema.sections.crn))
    .limit(limit);

  return { displayName, rows };
}

export async function listTopCourseKeysBySectionCount(
  db: Database,
  limit: number,
): Promise<{ subject: string; courseNumber: string }[]> {
  const rows = await db
    .select({
      subject: schema.sections.subject,
      courseNumber: schema.sections.courseNumber,
      n: sql<number>`count(*)::int`,
    })
    .from(schema.sections)
    .groupBy(schema.sections.subject, schema.sections.courseNumber)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows.map((r) => ({
    subject: r.subject,
    courseNumber: r.courseNumber,
  }));
}

export async function listAllDistinctCourseKeys(
  db: Database,
): Promise<
  { subject: string; courseNumber: string; lastMod: Date | null }[]
> {
  const rows = await db
    .select({
      subject: schema.sections.subject,
      courseNumber: schema.sections.courseNumber,
      lastMod: max(schema.sections.updatedAt),
    })
    .from(schema.sections)
    .groupBy(schema.sections.subject, schema.sections.courseNumber);
  return rows.map((r) => ({
    subject: r.subject,
    courseNumber: r.courseNumber,
    lastMod: r.lastMod,
  }));
}

/** DB entry points used by SEO routes (no `"use cache"` here: keeps builds compatible without `cacheComponents`). */
export async function listSubjectsForTermCached(termCode: string) {
  const db = createDb();
  return listSubjectsForTerm(db, termCode);
}

export async function listCoursesForSubjectAndTermCached(
  termCode: string,
  subject: string,
) {
  const db = createDb();
  return listCoursesForSubjectAndTerm(db, termCode, subject);
}

export async function getCourseSeoDetailCached(subject: string, courseNumber: string) {
  const db = createDb();
  return getCourseSeoDetail(db, subject, courseNumber);
}

export async function listSectionTableRowsForCourseTermCached(
  termCode: string,
  subject: string,
  courseNumber: string,
) {
  const db = createDb();
  return listSectionTableRowsForCourseTerm(db, termCode, subject, courseNumber);
}

export async function listInstructorsForSeoCached(minSections = 3) {
  const db = createDb();
  return listInstructorsForSeo(db, minSections);
}

export async function listSectionsForInstructorDisplayNameCached(
  displayName: string,
  _slug: string,
) {
  const db = createDb();
  return listSectionsForInstructorDisplayName(db, displayName);
}
