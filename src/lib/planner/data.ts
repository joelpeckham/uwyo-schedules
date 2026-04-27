import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { canonicalAggregateCourseTitle } from "@/lib/catalog/canonicalCourseTitleSql";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { bannerClockToMinutes } from "./banner-time";
import {
  CALENDAR_HOUR_COUNT,
  CALENDAR_START_HOUR,
} from "./constants";
import {
  resolveDisplayCrns,
  type PlannerItemSelection,
  type SelectionKind,
} from "./resolve-display-crns";
import { decodeHtmlEntities } from "@/lib/text/decodeHtmlEntities";
import { escapeIlikePattern } from "./search-escape";
import {
  normalizeMeetingScheduleType,
  normalizeScheduleTypeKey,
} from "./swap-helpers";

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

const DAY_FIELDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function dayIndexForField(
  field: (typeof DAY_FIELDS)[number],
): number | null {
  const i = DAY_FIELDS.indexOf(field);
  return i >= 0 ? i : null;
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

export async function listLinkedBundleOptions(
  db: Database,
  termCode: string,
  anchorCrn: string,
): Promise<LinkedBundleOption[]> {
  const bundles = await db
    .select({
      id: schema.linkedBundles.id,
      bundleIndex: schema.linkedBundles.bundleIndex,
    })
    .from(schema.linkedBundles)
    .where(
      and(
        eq(schema.linkedBundles.termCode, termCode),
        eq(schema.linkedBundles.anchorCrn, anchorCrn),
      ),
    )
    .orderBy(asc(schema.linkedBundles.bundleIndex));

  if (bundles.length === 0) return [];

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

  return bundles.map((b) => {
    const list = (byBundle.get(b.id) ?? []).sort((a, c) => a.position - c.position);
    const memberCrns = list.map((x) => x.crn);
    const parts = memberCrns.map(
      (crn) => sectionLabels.get(crn) ?? `CRN ${crn}`,
    );
    const summary =
      parts.length > 0
        ? parts.join(" · ")
        : `Option ${b.bundleIndex + 1}`;
    return {
      id: b.id,
      bundleIndex: b.bundleIndex,
      memberCrns,
      summary,
    };
  });
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

export async function buildCalendarBlocks(
  db: Database,
  sessionId: string,
  termCode: string,
  /** When set, skips an extra `listPlannerItems` query (e.g. post-swap refresh). */
  plannerItemsCached?: PlannerItemRow[],
): Promise<CalendarBlock[]> {
  const items =
    plannerItemsCached ?? (await listPlannerItems(db, sessionId, termCode));
  if (items.length === 0) return [];

  const crnsByItemId = new Map<number, string[]>();
  const allCrns = new Set<string>();
  for (const item of items) {
    const sel: PlannerItemSelection = {
      selectionKind: item.selectionKind as PlannerItemSelection["selectionKind"],
      anchorCrn: item.anchorCrn,
      linkedBundleId: item.linkedBundleId,
    };
    const crns = await resolveDisplayCrns(db, sel);
    crnsByItemId.set(item.id, crns);
    crns.forEach((c) => allCrns.add(c));
  }

  const crnList = [...allCrns];
  if (crnList.length === 0) return [];

  const meetings = await db
    .select()
    .from(schema.sectionMeetings)
    .where(
      and(
        eq(schema.sectionMeetings.termCode, termCode),
        inArray(schema.sectionMeetings.sectionCrn, crnList),
      ),
    );

  const facultyRows = await db
    .select({
      sectionCrn: schema.sectionFaculty.sectionCrn,
      displayName: schema.sectionFaculty.displayName,
      sortOrder: schema.sectionFaculty.sortOrder,
      primaryIndicator: schema.sectionFaculty.primaryIndicator,
      id: schema.sectionFaculty.id,
    })
    .from(schema.sectionFaculty)
    .where(
      and(
        eq(schema.sectionFaculty.termCode, termCode),
        inArray(schema.sectionFaculty.sectionCrn, crnList),
      ),
    )
    .orderBy(
      schema.sectionFaculty.sectionCrn,
      desc(schema.sectionFaculty.primaryIndicator),
      asc(schema.sectionFaculty.sortOrder),
      asc(schema.sectionFaculty.id),
    );

  const facultyByCrn = new Map<string, string>();
  {
    const namesByCrn = new Map<string, string[]>();
    for (const r of facultyRows) {
      const name = r.displayName?.trim();
      if (!name) continue;
      const decoded = decodeHtmlEntities(name) ?? name;
      const list = namesByCrn.get(r.sectionCrn) ?? [];
      list.push(decoded);
      namesByCrn.set(r.sectionCrn, list);
    }
    for (const [crn, names] of namesByCrn) {
      facultyByCrn.set(crn, names.join(", "));
    }
  }

  const sectionTitles = await loadSectionLabels(db, termCode, crnList);

  const schedRows = await db
    .select({
      crn: schema.sections.crn,
      scheduleTypeDescription: schema.sections.scheduleTypeDescription,
    })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.termCode, termCode),
        inArray(schema.sections.crn, crnList),
      ),
    );
  const scheduleTypeByCrn = new Map<string, string | null>();
  for (const r of schedRows) {
    scheduleTypeByCrn.set(
      r.crn,
      decodeHtmlEntities(r.scheduleTypeDescription) ?? r.scheduleTypeDescription,
    );
  }

  const windowStart = CALENDAR_START_HOUR * 60;
  /** Exclusive end (midnight after last displayed hour). */
  const windowEnd = windowStart + CALENDAR_HOUR_COUNT * 60;

  const blocks: CalendarBlock[] = [];

  for (const item of items) {
    const itemCrns = new Set(crnsByItemId.get(item.id) ?? []);
    const label = `${item.subject} ${item.courseNumber}`;

    for (const m of meetings) {
      if (!itemCrns.has(m.sectionCrn)) continue;
      const start = bannerClockToMinutes(m.beginTime);
      const end = bannerClockToMinutes(m.endTime);
      if (start == null || end == null || end <= start) continue;

      const clipStart = Math.max(start, windowStart);
      const clipEnd = Math.min(end, windowEnd);
      if (clipEnd <= clipStart) continue;

      const bPart =
        decodeHtmlEntities(m.buildingDescription) ??
        m.buildingDescription ??
        decodeHtmlEntities(m.building) ??
        m.building;
      const room = decodeHtmlEntities(m.room) ?? m.room;
      const sub = [bPart, room].filter(Boolean).join(" ") || "";
      const facultyRaw = facultyByCrn.get(m.sectionCrn)?.trim() ?? "";
      const instructorSublabel =
        facultyRaw.length > 0 ? facultyRaw : null;

      for (const field of DAY_FIELDS) {
        if (!m[field]) continue;
        const dayIndex = dayIndexForField(field);
        if (dayIndex == null) continue;
        blocks.push({
          key: `${item.id}-${m.id}-${field}`,
          plannerItemId: item.id,
          sectionCrn: m.sectionCrn,
          meetingId: m.id,
          dayIndex,
          startMinutes: clipStart,
          endMinutes: clipEnd,
          label: sectionTitles.get(m.sectionCrn) ?? label,
          sublabel: sub,
          instructorSublabel,
          color: item.displayColor,
          subject: item.subject,
          courseNumber: item.courseNumber,
          sectionScheduleTypeKey: normalizeScheduleTypeKey(
            scheduleTypeByCrn.get(m.sectionCrn) ?? null,
          ),
          meetingScheduleType: m.meetingScheduleType ?? null,
        });
      }
    }
  }

  return blocks;
}

/** Meeting + section schedule context for calendar drag-swap. */
export async function getSectionMeetingContextForSwap(
  db: Database,
  termCode: string,
  sectionCrn: string,
  meetingId: number,
): Promise<{
  subject: string;
  courseNumber: string;
  scheduleTypeDescription: string | null;
  meetingScheduleType: string | null;
} | null> {
  const [row] = await db
    .select({
      subject: schema.sections.subject,
      courseNumber: schema.sections.courseNumber,
      scheduleTypeDescription: schema.sections.scheduleTypeDescription,
      meetingScheduleType: schema.sectionMeetings.meetingScheduleType,
    })
    .from(schema.sectionMeetings)
    .innerJoin(
      schema.sections,
      and(
        eq(schema.sections.termCode, schema.sectionMeetings.termCode),
        eq(schema.sections.crn, schema.sectionMeetings.sectionCrn),
      ),
    )
    .where(
      and(
        eq(schema.sectionMeetings.termCode, termCode),
        eq(schema.sectionMeetings.sectionCrn, sectionCrn),
        eq(schema.sectionMeetings.id, meetingId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    subject: row.subject,
    courseNumber: row.courseNumber,
    scheduleTypeDescription:
      decodeHtmlEntities(row.scheduleTypeDescription) ??
      row.scheduleTypeDescription,
    meetingScheduleType:
      decodeHtmlEntities(row.meetingScheduleType) ?? row.meetingScheduleType,
  };
}

/**
 * Ghost meeting rectangles for other sections of the same course with the same
 * section schedule type; optionally filtered by meetingScheduleType when the
 * source meeting has a non-null code.
 */
export async function listSameTypeSwapGhostMeetings(
  db: Database,
  params: {
    termCode: string;
    subject: string;
    courseNumber: string;
    excludeSectionCrn: string;
    sourceScheduleTypeDescription: string | null;
    /** Pre-normalized key from calendar blocks; skips description when non-empty. */
    sourceScheduleTypeKey?: string | null;
    sourceMeetingScheduleType: string | null;
  },
): Promise<SwapGhostMeeting[]> {
  const fromKey =
    params.sourceScheduleTypeKey != null &&
    params.sourceScheduleTypeKey.length > 0
      ? params.sourceScheduleTypeKey
      : "";
  const typeKey =
    fromKey.length > 0
      ? fromKey
      : normalizeScheduleTypeKey(params.sourceScheduleTypeDescription);
  if (typeKey.length === 0) return [];

  const sourceMt = normalizeMeetingScheduleType(
    params.sourceMeetingScheduleType,
  );

  const sectionRows = await db
    .select({
      crn: schema.sections.crn,
      scheduleTypeDescription: schema.sections.scheduleTypeDescription,
    })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.termCode, params.termCode),
        eq(schema.sections.subject, params.subject),
        eq(schema.sections.courseNumber, params.courseNumber),
      ),
    );

  const candidateCrns = sectionRows
    .filter(
      (r) =>
        r.crn !== params.excludeSectionCrn &&
        normalizeScheduleTypeKey(r.scheduleTypeDescription) === typeKey,
    )
    .map((r) => r.crn);

  if (candidateCrns.length === 0) return [];

  const meetings = await db
    .select({
      id: schema.sectionMeetings.id,
      sectionCrn: schema.sectionMeetings.sectionCrn,
      beginTime: schema.sectionMeetings.beginTime,
      endTime: schema.sectionMeetings.endTime,
      meetingScheduleType: schema.sectionMeetings.meetingScheduleType,
      monday: schema.sectionMeetings.monday,
      tuesday: schema.sectionMeetings.tuesday,
      wednesday: schema.sectionMeetings.wednesday,
      thursday: schema.sectionMeetings.thursday,
      friday: schema.sectionMeetings.friday,
      saturday: schema.sectionMeetings.saturday,
      sunday: schema.sectionMeetings.sunday,
    })
    .from(schema.sectionMeetings)
    .where(
      and(
        eq(schema.sectionMeetings.termCode, params.termCode),
        inArray(schema.sectionMeetings.sectionCrn, candidateCrns),
      ),
    );

  const windowStart = CALENDAR_START_HOUR * 60;
  const windowEnd = windowStart + CALENDAR_HOUR_COUNT * 60;
  const ghosts: SwapGhostMeeting[] = [];

  for (const m of meetings) {
    if (sourceMt != null) {
      const mt = normalizeMeetingScheduleType(m.meetingScheduleType);
      if (mt !== sourceMt) continue;
    }
    const start = bannerClockToMinutes(m.beginTime);
    const end = bannerClockToMinutes(m.endTime);
    if (start == null || end == null || end <= start) continue;

    const clipStart = Math.max(start, windowStart);
    const clipEnd = Math.min(end, windowEnd);
    if (clipEnd <= clipStart) continue;

    for (const field of DAY_FIELDS) {
      if (!m[field]) continue;
      const dayIndex = dayIndexForField(field);
      if (dayIndex == null) continue;
      ghosts.push({
        crn: m.sectionCrn,
        meetingId: m.id,
        dayIndex,
        startMinutes: clipStart,
        endMinutes: clipEnd,
      });
    }
  }

  return ghosts;
}

/**
 * Precompute swap ghosts for every unique calendar block (parallel queries).
 * Passed to the client so drag starts without a round trip.
 */
export async function buildSwapGhostsPrefetchMap(
  db: Database,
  termCode: string,
  blocks: CalendarBlock[],
): Promise<Record<string, SwapGhostMeeting[]>> {
  const unique = new Map<string, CalendarBlock>();
  for (const b of blocks) {
    const k = swapPrefetchKey(b.plannerItemId, b.sectionCrn, b.meetingId);
    if (!unique.has(k)) unique.set(k, b);
  }
  const pairs = await Promise.all(
    [...unique.values()].map(async (b) => {
      const k = swapPrefetchKey(b.plannerItemId, b.sectionCrn, b.meetingId);
      if (!b.sectionScheduleTypeKey) {
        return [k, []] as const;
      }
      const ghosts = await listSameTypeSwapGhostMeetings(db, {
        termCode,
        subject: b.subject,
        courseNumber: b.courseNumber,
        excludeSectionCrn: b.sectionCrn,
        sourceScheduleTypeDescription: null,
        sourceScheduleTypeKey: b.sectionScheduleTypeKey,
        sourceMeetingScheduleType: b.meetingScheduleType,
      });
      return [k, ghosts] as const;
    }),
  );
  return Object.fromEntries(pairs);
}

/** Bundles where `crn` is the anchor or a linked member (same term). */
export async function findLinkedBundlesContainingCrn(
  db: Database,
  termCode: string,
  crn: string,
): Promise<{ bundleId: number; anchorCrn: string; bundleIndex: number }[]> {
  const anchored = await db
    .select({
      bundleId: schema.linkedBundles.id,
      anchorCrn: schema.linkedBundles.anchorCrn,
      bundleIndex: schema.linkedBundles.bundleIndex,
    })
    .from(schema.linkedBundles)
    .where(
      and(
        eq(schema.linkedBundles.termCode, termCode),
        eq(schema.linkedBundles.anchorCrn, crn),
      ),
    );

  const asMember = await db
    .select({
      bundleId: schema.linkedBundles.id,
      anchorCrn: schema.linkedBundles.anchorCrn,
      bundleIndex: schema.linkedBundles.bundleIndex,
    })
    .from(schema.linkedBundleMembers)
    .innerJoin(
      schema.linkedBundles,
      eq(schema.linkedBundles.id, schema.linkedBundleMembers.bundleId),
    )
    .where(
      and(
        eq(schema.linkedBundles.termCode, termCode),
        eq(schema.linkedBundleMembers.crn, crn),
      ),
    );

  const byId = new Map<
    number,
    { bundleId: number; anchorCrn: string; bundleIndex: number }
  >();
  for (const r of [...anchored, ...asMember]) {
    byId.set(r.bundleId, r);
  }
  return [...byId.values()].sort((a, b) => {
    if (a.anchorCrn !== b.anchorCrn) return a.anchorCrn.localeCompare(b.anchorCrn);
    return a.bundleIndex - b.bundleIndex;
  });
}

/**
 * Validates a calendar swap and returns selection fields for `planner_items`.
 * Linked courses: picks the bundle (among those containing `targetCrn`) with
 * maximal overlap with currently displayed CRNs; tie-break `bundleIndex`.
 */
export async function resolvePlannerSwapCommit(
  db: Database,
  sessionId: string,
  params: {
    termCode: string;
    plannerItemId: number;
    targetCrn: string;
    sourceSectionCrn: string;
    sourceMeetingId: number;
  },
): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      selectionKind: SelectionKind;
      anchorCrn: string;
      linkedBundleId: number | null;
    }
> {
  const [item] = await db
    .select()
    .from(schema.plannerItems)
    .where(
      and(
        eq(schema.plannerItems.id, params.plannerItemId),
        eq(schema.plannerItems.sessionId, sessionId),
        eq(schema.plannerItems.termCode, params.termCode),
      ),
    )
    .limit(1);
  if (!item) return { ok: false, error: "Item not found." };

  const ctx = await getSectionMeetingContextForSwap(
    db,
    params.termCode,
    params.sourceSectionCrn,
    params.sourceMeetingId,
  );
  if (!ctx) return { ok: false, error: "Meeting not found." };
  if (
    ctx.subject !== item.subject ||
    ctx.courseNumber !== item.courseNumber
  ) {
    return { ok: false, error: "Meeting does not match this planner course." };
  }

  const ghosts = await listSameTypeSwapGhostMeetings(db, {
    termCode: params.termCode,
    subject: item.subject,
    courseNumber: item.courseNumber,
    excludeSectionCrn: params.sourceSectionCrn,
    sourceScheduleTypeDescription: null,
    sourceScheduleTypeKey: normalizeScheduleTypeKey(
      ctx.scheduleTypeDescription,
    ),
    sourceMeetingScheduleType: ctx.meetingScheduleType,
  });
  if (!ghosts.some((g) => g.crn === params.targetCrn)) {
    return {
      ok: false,
      error: "That section is not a same-type alternative for this block.",
    };
  }

  const bundled = await findLinkedBundlesContainingCrn(
    db,
    params.termCode,
    params.targetCrn,
  );
  if (bundled.length === 0) {
    return {
      ok: true,
      selectionKind: "single_crn",
      anchorCrn: params.targetCrn,
      linkedBundleId: null,
    };
  }

  const sel: PlannerItemSelection = {
    selectionKind: item.selectionKind as PlannerItemSelection["selectionKind"],
    anchorCrn: item.anchorCrn,
    linkedBundleId: item.linkedBundleId,
  };
  const currentCrns = await resolveDisplayCrns(db, sel);

  /** Among bundles that include `targetCrn`, maximize overlap with current CRNs; tie-break `bundleIndex`. */
  const bundleIds = [...new Set(bundled.map((b) => b.bundleId))];
  const memberRows = await db
    .select({
      bundleId: schema.linkedBundleMembers.bundleId,
      crn: schema.linkedBundleMembers.crn,
    })
    .from(schema.linkedBundleMembers)
    .where(inArray(schema.linkedBundleMembers.bundleId, bundleIds));

  const membersByBundle = new Map<number, string[]>();
  for (const r of memberRows) {
    const arr = membersByBundle.get(r.bundleId) ?? [];
    arr.push(r.crn);
    membersByBundle.set(r.bundleId, arr);
  }

  let best: {
    bundleId: number;
    anchorCrn: string;
    bundleIndex: number;
    score: number;
  } | null = null;

  for (const b of bundled) {
    const members = membersByBundle.get(b.bundleId) ?? [];
    const full = new Set<string>([b.anchorCrn, ...members]);
    let score = 0;
    for (const c of currentCrns) {
      if (full.has(c)) score++;
    }
    if (
      !best ||
      score > best.score ||
      (score === best.score && b.bundleIndex < best.bundleIndex)
    ) {
      best = {
        bundleId: b.bundleId,
        anchorCrn: b.anchorCrn,
        bundleIndex: b.bundleIndex,
        score,
      };
    }
  }

  if (!best) {
    return { ok: false, error: "Could not resolve linked registration." };
  }

  return {
    ok: true,
    selectionKind: "linked_bundle",
    anchorCrn: best.anchorCrn,
    linkedBundleId: best.bundleId,
  };
}
