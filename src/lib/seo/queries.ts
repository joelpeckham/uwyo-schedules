import { cacheLife, cacheTag } from "next/cache";
import { createDb } from "@/db/index";
import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { canonicalAggregateCourseTitle } from "@/lib/catalog/canonicalCourseTitleSql";
import { sanitizeSectionRawJson } from "@/lib/planner/section-detail-sanitize";
import { meetingHasTimeBlock } from "@/lib/sections/delivery-mode";
import { decodeHtmlEntities } from "@/lib/text/decodeHtmlEntities";
import {
  SEO_SITEMAP_TAG,
  seoCourseTag,
  seoCrnTag,
  seoInstructorTag,
  seoTermSubjectTag,
  seoTermTag,
} from "@/lib/seo/cache-tags";
import {
  getLatestTermCode,
  getSectionDetail,
  listTerms,
  termExists,
} from "@/lib/planner/data";
import {
  getLatestTermRow,
  getTermDescriptionByCode,
} from "@/lib/terms/labels";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, max, sql } from "drizzle-orm";

/** URL path segment for Banner subject (e.g. `MATH` → `math`). */
export function subjectToPathSegment(subject: string): string {
  return subject.trim().toLowerCase();
}

/** Canonical Banner subject for lookups from a path segment. */
export function pathSegmentToSubject(segment: string): string {
  return segment.trim().toUpperCase();
}

type SubjectRow = {
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

type CourseListRow = {
  subject: string;
  courseNumber: string;
  subjectCourse: string | null;
  title: string | null;
  sectionCount: number;
  creditHours: number | null;
};

async function listCoursesForSubjectAndTerm(
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
      title: canonicalAggregateCourseTitle(),
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
    subjectCourse: decodeHtmlEntities(r.subjectCourse),
    title: decodeHtmlEntities(r.title),
    sectionCount: r.sectionCount,
    creditHours: r.creditHours,
  }));
}

type CourseTermSummary = {
  termCode: string;
  termDescription: string;
  sectionCount: number;
  lastUpdated: Date | null;
};

type CourseSeoDetail = {
  subject: string;
  courseNumber: string;
  /** Best-known title across terms. */
  title: string | null;
  terms: CourseTermSummary[];
};

async function getCourseSeoDetail(
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
    .select({ title: canonicalAggregateCourseTitle() })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.subject, subj),
        eq(schema.sections.courseNumber, num),
      ),
    );
  const title = decodeHtmlEntities(titleRow[0]?.title ?? null);

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
    title:
      title ?? decodeHtmlEntities(termRows[0]?.termDescription ?? null) ?? null,
    terms: termRows.map((t) => ({
      termCode: t.termCode,
      termDescription: decodeHtmlEntities(t.termDescription) ?? t.termDescription,
      sectionCount: t.sectionCount,
      lastUpdated: t.lastUpdated,
    })),
  };
}

type SectionTableRow = {
  crn: string;
  termCode: string;
  courseTitle: string | null;
  scheduleTypeDescription: string | null;
  seatsAvailable: number | null;
  enrollment: number | null;
  maximumEnrollment: number | null;
  facultyNames: string | null;
  meetingSummary: string | null;
  instructionalMethod: string | null;
  instructionalMethodDescription: string | null;
  hasTimedMeetings: boolean;
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
  const dayPart = days.length > 0 ? days.join("") : null;
  const time =
    m.beginTime && m.endTime ? `${m.beginTime}–${m.endTime}` : null;
  const b = decodeHtmlEntities(m.building);
  const rm = decodeHtmlEntities(m.room);
  const bd = decodeHtmlEntities(m.buildingDescription);
  const cd = decodeHtmlEntities(m.campusDescription);
  const place =
    b && rm ? `${b} ${rm}` : (bd ?? cd ?? "");
  return [dayPart, time, place].filter(Boolean).join(" · ");
}

async function listSectionTableRowsForCourseTerm(
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
      instructionalMethod: schema.sections.instructionalMethod,
      instructionalMethodDescription:
        schema.sections.instructionalMethodDescription,
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
    const decoded = decodeHtmlEntities(f.name) ?? f.name;
    const list = facultyByCrn.get(f.crn) ?? [];
    list.push(decoded);
    facultyByCrn.set(f.crn, list);
  }

  return sectionRows.map((s) => {
    const ms = meetingsByCrn.get(s.crn) ?? [];
    const summaryParts = ms.map(formatMeetingRow).filter((line) => line.length > 0);
    const meetingSummary = summaryParts.length > 0 ? summaryParts.join("; ") : null;
    const hasTimedMeetings = ms.some((m) => meetingHasTimeBlock(m));
    const names = facultyByCrn.get(s.crn);
    return {
      crn: s.crn,
      termCode,
      courseTitle: decodeHtmlEntities(s.courseTitle),
      scheduleTypeDescription: decodeHtmlEntities(s.scheduleTypeDescription),
      seatsAvailable: s.seatsAvailable,
      enrollment: s.enrollment,
      maximumEnrollment: s.maximumEnrollment,
      facultyNames: names && names.length > 0 ? names.join(", ") : null,
      meetingSummary,
      instructionalMethod: decodeHtmlEntities(s.instructionalMethod),
      instructionalMethodDescription: decodeHtmlEntities(
        s.instructionalMethodDescription,
      ),
      hasTimedMeetings,
    };
  });
}

function slugifyInstructorName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type InstructorIndexRow = {
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
    const raw = r.displayName?.trim();
    if (!raw) continue;
    const name = decodeHtmlEntities(raw) ?? raw;
    const slug = slugifyInstructorName(name);
    if (!slug) continue;
    out.push({ slug, displayName: name, sectionCount: r.sectionCount });
  }
  out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return out;
}

async function listSectionsForInstructorDisplayName(
  db: Database,
  displayName: string,
  limit = 200,
) {
  const raw = await db
    .select({
      termCode: schema.sections.termCode,
      crn: schema.sections.crn,
      subject: schema.sections.subject,
      courseNumber: schema.sections.courseNumber,
      subjectCourse: schema.sections.subjectCourse,
      courseTitle: schema.sections.courseTitle,
      scheduleTypeDescription: schema.sections.scheduleTypeDescription,
      termDescription: schema.terms.description,
    })
    .from(schema.sectionFaculty)
    .innerJoin(
      schema.sections,
      and(
        eq(schema.sections.termCode, schema.sectionFaculty.termCode),
        eq(schema.sections.crn, schema.sectionFaculty.sectionCrn),
      ),
    )
    .innerJoin(
      schema.terms,
      eq(schema.terms.code, schema.sections.termCode),
    )
    .where(eq(schema.sectionFaculty.displayName, displayName))
    .orderBy(desc(schema.sections.termCode), asc(schema.sections.crn))
    .limit(limit);

  const rows = raw.map((r) => ({
    termCode: r.termCode,
    crn: r.crn,
    subject: r.subject,
    courseNumber: r.courseNumber,
    subjectCourse: decodeHtmlEntities(r.subjectCourse),
    courseTitle: decodeHtmlEntities(r.courseTitle),
    scheduleTypeDescription: decodeHtmlEntities(r.scheduleTypeDescription),
    termDescription: decodeHtmlEntities(r.termDescription) ?? r.termDescription,
  }));

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

export async function countDistinctCourseKeys(db: Database): Promise<number> {
  const rows = await db
    .select({
      n: sql<number>`count(distinct (${schema.sections.subject}, ${schema.sections.courseNumber}))::int`,
    })
    .from(schema.sections);
  return rows[0]?.n ?? 0;
}

export async function listDistinctCourseKeysPage(
  db: Database,
  opts: { limit: number; offset: number },
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
    .groupBy(schema.sections.subject, schema.sections.courseNumber)
    .orderBy(asc(schema.sections.subject), asc(schema.sections.courseNumber))
    .limit(opts.limit)
    .offset(opts.offset);
  return rows.map((r) => ({
    subject: r.subject,
    courseNumber: r.courseNumber,
    lastMod: r.lastMod,
  }));
}

/**
 * Route helpers wrapped with Next.js 16 Cache Components (`'use cache'`).
 *
 * Each helper opens its own DB client per call so it can safely be invoked
 * from any RSC/route segment. The `cacheTag` calls let `replaceTermData`
 * (and other writers) call `revalidateTag` to tie SEO freshness to scrapes
 * rather than a wall-clock `revalidate`.
 */
export async function listSubjectsForTermForSeo(termCode: string) {
  "use cache";
  cacheTag(seoTermTag(termCode), SEO_SITEMAP_TAG);
  cacheLife("hours");
  const db = createDb();
  return listSubjectsForTerm(db, termCode);
}

export async function listCoursesForSubjectAndTermForSeo(
  termCode: string,
  subject: string,
) {
  "use cache";
  cacheTag(
    seoTermSubjectTag(termCode, subject),
    seoTermTag(termCode),
  );
  cacheLife("hours");
  const db = createDb();
  return listCoursesForSubjectAndTerm(db, termCode, subject);
}

export async function getCourseSeoDetailForSeo(
  subject: string,
  courseNumber: string,
) {
  "use cache";
  cacheTag(seoCourseTag(subject, courseNumber));
  cacheLife("hours");
  const db = createDb();
  return getCourseSeoDetail(db, subject, courseNumber);
}

export async function listSectionTableRowsForCourseTermForSeo(
  termCode: string,
  subject: string,
  courseNumber: string,
) {
  "use cache";
  cacheTag(
    seoCourseTag(subject, courseNumber),
    seoTermTag(termCode),
  );
  cacheLife("hours");
  const db = createDb();
  return listSectionTableRowsForCourseTerm(db, termCode, subject, courseNumber);
}

type SectionSeoDetail = {
  termCode: string;
  termDescription: string | null;
  crn: string;
  subject: string;
  courseNumber: string;
  subjectCourse: string | null;
  sequenceNumber: string | null;
  courseTitle: string | null;
  scheduleTypeDescription: string | null;
  /** Sanitized Banner detail JSON, ready to feed into `<SectionDetailPanels />`. */
  detailRoot: Record<string, unknown> | null;
  /** Comma-joined faculty display names for SEO metadata. */
  facultyNames: string | null;
};

async function getSectionDetailForSeoInner(
  db: Database,
  termCode: string,
  crn: string,
): Promise<SectionSeoDetail | null> {
  const row = await getSectionDetail(db, termCode, crn);
  if (!row) return null;

  const [termRow] = await db
    .select({ description: schema.terms.description })
    .from(schema.terms)
    .where(eq(schema.terms.code, termCode))
    .limit(1);

  const facultyRows = await db
    .select({
      name: schema.sectionFaculty.displayName,
      sort: schema.sectionFaculty.sortOrder,
    })
    .from(schema.sectionFaculty)
    .where(
      and(
        eq(schema.sectionFaculty.termCode, termCode),
        eq(schema.sectionFaculty.sectionCrn, crn),
      ),
    )
    .orderBy(asc(schema.sectionFaculty.sortOrder));
  const facultyNames =
    facultyRows
      .map((f) => decodeHtmlEntities(f.name) ?? f.name)
      .filter((n): n is string => Boolean(n))
      .join(", ") || null;

  return {
    termCode,
    termDescription: decodeHtmlEntities(termRow?.description ?? null),
    crn,
    subject: row.subject,
    courseNumber: row.courseNumber,
    subjectCourse: row.subjectCourse ?? null,
    sequenceNumber: row.sequenceNumber ?? null,
    courseTitle: row.courseTitle ?? null,
    scheduleTypeDescription: row.scheduleTypeDescription ?? null,
    detailRoot: (() => {
      const root = sanitizeSectionRawJson(row.rawJson) ?? {};
      if (row.courseDescription) root.courseDescription = row.courseDescription;
      if (row.sectionInformationText) {
        root.sectionInformationText = row.sectionInformationText;
      }
      return root;
    })(),
    facultyNames,
  };
}

export async function getSectionDetailForSeo(termCode: string, crn: string) {
  "use cache";
  cacheTag(seoCrnTag(termCode, crn), seoTermTag(termCode));
  cacheLife("hours");
  const db = createDb();
  return getSectionDetailForSeoInner(db, termCode, crn);
}

/**
 * Latest-term CRNs sorted by section count of their parent course, used by
 * `generateStaticParams` for the per-CRN page so the highest-traffic
 * sections are baked at build time. The page is otherwise dynamic and
 * still serves on demand for the long tail.
 */
export async function listTopCrnsForSeo(
  limit: number,
): Promise<{ termCode: string; subject: string; courseNumber: string; crn: string }[]> {
  "use cache";
  cacheTag(SEO_SITEMAP_TAG);
  cacheLife("hours");
  const db = createDb();
  const latest = await getLatestTermCode(db);
  if (!latest) return [];
  const rows = await db
    .select({
      termCode: schema.sections.termCode,
      subject: schema.sections.subject,
      courseNumber: schema.sections.courseNumber,
      crn: schema.sections.crn,
    })
    .from(schema.sections)
    .where(eq(schema.sections.termCode, latest))
    .orderBy(asc(schema.sections.subject), asc(schema.sections.courseNumber))
    .limit(limit);
  return rows;
}

/**
 * Resolve the most recent term that has this CRN. CRNs are unique per term
 * but Banner reuses them across terms, so we always pick the newest match
 * for the public page. Returns `null` when no row exists at all.
 */
export async function findTermForCrnForSeo(
  crn: string,
): Promise<string | null> {
  "use cache";
  cacheTag(SEO_SITEMAP_TAG);
  cacheLife("hours");
  const db = createDb();
  const [row] = await db
    .select({ termCode: schema.sections.termCode })
    .from(schema.sections)
    .where(eq(schema.sections.crn, crn))
    .orderBy(desc(schema.sections.termCode))
    .limit(1);
  return row?.termCode ?? null;
}

export async function listInstructorsIndexForSeo(minSections = 3) {
  "use cache";
  cacheTag(SEO_SITEMAP_TAG);
  cacheLife("hours");
  const db = createDb();
  return listInstructorsForSeo(db, minSections);
}

export async function listSectionsForInstructorForSeo(
  displayName: string,
  slug?: string,
) {
  "use cache";
  if (slug) cacheTag(seoInstructorTag(slug));
  cacheLife("hours");
  const db = createDb();
  return listSectionsForInstructorDisplayName(db, displayName);
}

/**
 * Cached helpers around `lib/planner/data` and `lib/terms/labels` so SEO
 * pages can read term metadata without a fresh Postgres round-trip per
 * request. Tagged with `SEO_SITEMAP_TAG` because every term ingest already
 * invalidates that broad tag.
 */
export async function getLatestTermCodeForSeo(): Promise<string | null> {
  "use cache";
  cacheTag(SEO_SITEMAP_TAG);
  cacheLife("hours");
  const db = createDb();
  return getLatestTermCode(db);
}

export async function getLatestTermRowForSeo(): Promise<
  { code: string; description: string } | null
> {
  "use cache";
  cacheTag(SEO_SITEMAP_TAG);
  cacheLife("hours");
  const db = createDb();
  return getLatestTermRow(db);
}

export async function termExistsForSeo(termCode: string): Promise<boolean> {
  "use cache";
  cacheTag(SEO_SITEMAP_TAG);
  cacheLife("hours");
  const db = createDb();
  return termExists(db, termCode);
}

export async function getTermDescriptionByCodeForSeo(
  termCode: string,
): Promise<string | null> {
  "use cache";
  cacheTag(seoTermTag(termCode));
  cacheLife("hours");
  return getTermDescriptionByCode(termCode);
}

export async function listTermsForSeo() {
  "use cache";
  cacheTag(SEO_SITEMAP_TAG);
  cacheLife("hours");
  const db = createDb();
  return listTerms(db);
}
