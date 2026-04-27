import type { PlannerItemRow } from "./data";
import type { InstructorPrefsV1 } from "./instructor-prefs";
import { parseInstructorPrefs } from "./instructor-prefs";
import type { PlannerItemSelection, ResolvedPlannerSelection } from "./resolve-display-crns-shared";
import { resolveDisplayCrnsSync } from "./resolve-display-crns-shared";
import { bannerClockToMinutes } from "./banner-time";
import {
  filterCandidatesBySectionPins,
  parseSectionPinsJson,
} from "./section-pins";
import { normalizeScheduleTypeKey } from "./swap-helpers";

const DAY_FIELDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type TimeInterval = {
  dayIndex: number;
  start: number;
  end: number;
};

export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  if (a.dayIndex !== b.dayIndex) return false;
  return a.start < b.end && b.start < a.end;
}

export function hasAnyOverlap(intervals: TimeInterval[]): boolean {
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      if (intervalsOverlap(intervals[i]!, intervals[j]!)) return true;
    }
  }
  return false;
}

/** Expand section_meetings row into per-day intervals (minutes from midnight). */
export function meetingRowToIntervals(row: {
  beginTime: string | null;
  endTime: string | null;
  monday: boolean | null;
  tuesday: boolean | null;
  wednesday: boolean | null;
  thursday: boolean | null;
  friday: boolean | null;
  saturday: boolean | null;
  sunday: boolean | null;
}): TimeInterval[] {
  const start = bannerClockToMinutes(row.beginTime);
  const end = bannerClockToMinutes(row.endTime);
  if (start == null || end == null || end <= start) return [];
  const out: TimeInterval[] = [];
  for (let dayIndex = 0; dayIndex < DAY_FIELDS.length; dayIndex++) {
    const field = DAY_FIELDS[dayIndex]!;
    if (row[field]) out.push({ dayIndex, start, end });
  }
  return out;
}

export type ScheduleCandidate = {
  selectionKind: "single_crn" | "linked_bundle";
  anchorCrn: string;
  linkedBundleId: number | null;
  crns: string[];
};

export type ScheduleSolution = {
  score: number;
  /** planner item id → resolved selection */
  selections: Record<number, ResolvedPlannerSelection>;
};

const MAX_SOLUTIONS = 500;
const DEFAULT_TIMEOUT_MS = 2000;

export function courseSolvePackCourseKey(
  subject: string,
  courseNumber: string,
): string {
  return `${subject}\0${courseNumber}`;
}

export type CourseSolvePack = {
  v: 1;
  courseKey: string;
  termCode: string;
  subject: string;
  courseNumber: string;
  candidates: ScheduleCandidate[];
  /** Ordered member CRNs per bundle id (string keys for JSON). */
  bundleMembersById: Record<string, string[]>;
  meetingsByCrn: Record<string, TimeInterval[]>;
  facultyByCrn: Record<
    string,
    { displayName: string | null; primaryIndicator: boolean | null }[]
  >;
  scheduleTypeByCrn: Record<string, string | null>;
  seatsByCrn: Record<
    string,
    { seatsAvailable: number | null; openSection: boolean | null }
  >;
};

function selectionFromCandidate(c: ScheduleCandidate): ResolvedPlannerSelection {
  return {
    selectionKind: c.selectionKind,
    anchorCrn: c.anchorCrn,
    linkedBundleId: c.linkedBundleId,
  };
}

/** Exported for tests: whether `single_crn` alone is a valid registration for this CRN. */
export function eligibleForStandaloneSingleCrn(
  crn: string,
  linkedNonAnchorMemberCrns: ReadonlySet<string>,
): boolean {
  return !linkedNonAnchorMemberCrns.has(crn);
}

function orderedPrefScore(prefs: string[], facultyNames: (string | null)[]): number {
  const names = facultyNames
    .map((n) => (n ?? "").trim().toLowerCase())
    .filter(Boolean);
  if (names.length === 0 || prefs.length === 0) return 0;
  for (let i = 0; i < prefs.length; i++) {
    const p = prefs[i]!.trim().toLowerCase();
    if (!p) continue;
    for (const n of names) {
      if (n.includes(p) || p.includes(n)) {
        return (prefs.length - i) * 10;
      }
    }
  }
  return 0;
}

/** True if at least one non-empty pref matches some faculty name (bidirectional includes, case-insensitive). */
export function facultyNamesMatchAnyListedPref(
  prefs: string[],
  facultyNames: (string | null)[],
): boolean {
  return orderedPrefScore(prefs, facultyNames) > 0;
}

function anchorPrimaryFacultyPool(
  anchorFaculty: { displayName: string | null; primaryIndicator: boolean | null }[],
): (string | null)[] {
  const primaryNames = anchorFaculty
    .filter((f) => f.primaryIndicator === true)
    .map((f) => f.displayName);
  return primaryNames.length > 0
    ? primaryNames
    : anchorFaculty.map((f) => f.displayName);
}

/** Hard filter: false = candidate is allowed under prefs. */
export function candidateViolatesHardInstructorPrefs(
  cand: ScheduleCandidate,
  prefs: InstructorPrefsV1,
  facultyByCrn: Map<string, { displayName: string | null; primaryIndicator: boolean | null }[]>,
  scheduleTypeByCrn: Map<string, string | null>,
): boolean {
  const primaryPrefs = prefs.primary.map((s) => s.trim()).filter(Boolean);
  if (primaryPrefs.length > 0) {
    const anchorFaculty = facultyByCrn.get(cand.anchorCrn) ?? [];
    const pool = anchorPrimaryFacultyPool(anchorFaculty);
    if (!facultyNamesMatchAnyListedPref(primaryPrefs, pool)) return true;
  }

  if (prefs.byScheduleType) {
    for (const [typeKey, typePrefsRaw] of Object.entries(prefs.byScheduleType)) {
      const typePrefs = typePrefsRaw.map((s) => s.trim()).filter(Boolean);
      if (typePrefs.length === 0) continue;
      const crnsOfType: string[] = [];
      for (const crn of cand.crns) {
        const st = scheduleTypeByCrn.get(crn) ?? null;
        if (normalizeScheduleTypeKey(st) === typeKey) crnsOfType.push(crn);
      }
      if (crnsOfType.length === 0) continue;
      for (const crn of crnsOfType) {
        const fac = facultyByCrn.get(crn) ?? [];
        const pool = fac.map((f) => f.displayName);
        if (!facultyNamesMatchAnyListedPref(typePrefs, pool)) return true;
      }
    }
  }

  return false;
}

function scoreCandidate(
  item: PlannerItemRow,
  cand: ScheduleCandidate,
  prefs: InstructorPrefsV1,
  facultyByCrn: Map<string, { displayName: string | null; primaryIndicator: boolean | null }[]>,
  scheduleTypeByCrn: Map<string, string | null>,
): number {
  let score = 0;
  const anchorFaculty = facultyByCrn.get(cand.anchorCrn) ?? [];
  const primaryPool = anchorPrimaryFacultyPool(anchorFaculty);
  score += orderedPrefScore(prefs.primary, primaryPool);

  if (prefs.byScheduleType) {
    for (const crn of cand.crns) {
      const st = scheduleTypeByCrn.get(crn) ?? null;
      const key = normalizeScheduleTypeKey(st);
      const typePrefs = prefs.byScheduleType[key];
      if (!typePrefs?.length) continue;
      const fac = facultyByCrn.get(crn) ?? [];
      const pool = fac.map((f) => f.displayName);
      score += orderedPrefScore(typePrefs, pool);
    }
  }
  return score;
}

export function allCrnsHaveOpenSeats(
  crns: string[],
  seatsByCrn: Map<string, { seatsAvailable: number | null; openSection: boolean | null }>,
): boolean {
  for (const crn of crns) {
    const row = seatsByCrn.get(crn);
    if (!row) continue;
    if (row.seatsAvailable != null && row.seatsAvailable <= 0) return false;
    if (row.openSection === false) return false;
  }
  return true;
}

export type SolveSchedulesResult = {
  solutions: ScheduleSolution[];
  capped: boolean;
  timedOut: boolean;
  itemOrder: number[];
};

function mergeIntoMeetingsMap(
  target: Map<string, TimeInterval[]>,
  from: Record<string, TimeInterval[]>,
): void {
  for (const [k, v] of Object.entries(from)) {
    if (!target.has(k)) target.set(k, v);
  }
}

function mergeIntoFacultyMap(
  target: Map<string, { displayName: string | null; primaryIndicator: boolean | null }[]>,
  from: CourseSolvePack["facultyByCrn"],
): void {
  for (const [k, v] of Object.entries(from)) {
    if (!target.has(k)) target.set(k, v);
  }
}

function mergeIntoScheduleMap(
  target: Map<string, string | null>,
  from: Record<string, string | null>,
): void {
  for (const [k, v] of Object.entries(from)) {
    if (!target.has(k)) target.set(k, v);
  }
}

function mergeIntoSeatsMap(
  target: Map<string, { seatsAvailable: number | null; openSection: boolean | null }>,
  from: CourseSolvePack["seatsByCrn"],
): void {
  for (const [k, v] of Object.entries(from)) {
    if (!target.has(k)) target.set(k, v);
  }
}

function mergeBundleMembers(
  target: Map<number, string[]>,
  from: Record<string, string[]>,
): void {
  for (const [idStr, members] of Object.entries(from)) {
    const id = Number(idStr);
    if (!Number.isFinite(id)) continue;
    if (!target.has(id)) target.set(id, members);
  }
}

function courseIntervalsOverlapBlackouts(
  acc: TimeInterval[],
  blackouts: TimeInterval[],
): boolean {
  for (const b of blackouts) {
    for (const iv of acc) {
      if (intervalsOverlap(iv, b)) return true;
    }
  }
  return false;
}

/** Shared DFS + scoring (no DB). Used by server solve and `solveSchedulesFromPacks`. */
export function runSolveSearch(params: {
  items: PlannerItemRow[];
  candidateLists: ScheduleCandidate[][];
  meetingsByCrn: Map<string, TimeInterval[]>;
  facultyByCrn: Map<string, { displayName: string | null; primaryIndicator: boolean | null }[]>;
  scheduleTypeByCrn: Map<string, string | null>;
  seatsByCrn: Map<string, { seatsAvailable: number | null; openSection: boolean | null }>;
  requireOpenSections: boolean;
  /** User busy times; any overlap with a candidate section meeting rejects the candidate. */
  blackoutIntervals?: TimeInterval[];
  maxSolutions?: number;
  timeoutMs?: number;
}): SolveSchedulesResult {
  const {
    items,
    candidateLists,
    meetingsByCrn,
    facultyByCrn,
    scheduleTypeByCrn,
    seatsByCrn,
    requireOpenSections,
  } = params;
  const blackoutIntervals = params.blackoutIntervals ?? [];
  const maxSolutions = params.maxSolutions ?? MAX_SOLUTIONS;
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const indices = items.map((_, i) => i);
  indices.sort(
    (a, b) => candidateLists[a]!.length - candidateLists[b]!.length,
  );

  const solutions: ScheduleSolution[] = [];
  let capped = false;
  let timedOut = false;

  const chosen: (ScheduleCandidate | null)[] = items.map(() => null);

  function overlapsAccumulated(
    cand: ScheduleCandidate,
    excludeItemIndex: number,
  ): boolean {
    const acc: TimeInterval[] = [];
    for (let ii = 0; ii < items.length; ii++) {
      if (ii === excludeItemIndex) continue;
      const ch = chosen[ii];
      if (!ch) continue;
      for (const crn of ch.crns) {
        acc.push(...(meetingsByCrn.get(crn) ?? []));
      }
    }
    for (const crn of cand.crns) {
      acc.push(...(meetingsByCrn.get(crn) ?? []));
    }
    if (hasAnyOverlap(acc)) return true;
    return courseIntervalsOverlapBlackouts(acc, blackoutIntervals);
  }

  function dfs(depth: number): void {
    if (solutions.length >= maxSolutions) {
      capped = true;
      return;
    }
    if (Date.now() - started > timeoutMs) {
      timedOut = true;
      return;
    }
    if (depth === indices.length) {
      const selections: Record<number, ResolvedPlannerSelection> = {};
      let score = 0;
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const c = chosen[i]!;
        selections[item.id] = selectionFromCandidate(c);
        score += scoreCandidate(
          item,
          c,
          parseInstructorPrefs(item.instructorPrefs),
          facultyByCrn,
          scheduleTypeByCrn,
        );
      }
      solutions.push({ score, selections });
      return;
    }

    const itemIndex = indices[depth]!;
    const item = items[itemIndex]!;
    const list = candidateLists[itemIndex]!;

    for (const cand of list) {
      if (requireOpenSections && !allCrnsHaveOpenSeats(cand.crns, seatsByCrn)) {
        continue;
      }
      if (
        candidateViolatesHardInstructorPrefs(
          cand,
          parseInstructorPrefs(item.instructorPrefs),
          facultyByCrn,
          scheduleTypeByCrn,
        )
      ) {
        continue;
      }
      if (overlapsAccumulated(cand, itemIndex)) continue;

      chosen[itemIndex] = cand;
      dfs(depth + 1);
      chosen[itemIndex] = null;

      if (capped || timedOut) return;
    }
  }

  const started = Date.now();
  dfs(0);

  solutions.sort((a, b) => b.score - a.score);

  return {
    solutions,
    capped,
    timedOut,
    itemOrder: indices.map((i) => items[i]!.id),
  };
}

function candidateListForPlannerItem(
  item: PlannerItemRow,
  pack: CourseSolvePack | undefined,
  bundleMembersMerged: Map<number, string[]>,
): ScheduleCandidate[] {
  if (item.selectionKind === "unresolved") {
    const base = pack?.candidates ?? [];
    const pins = parseSectionPinsJson(item.sectionPins);
    const scheduleTypeByCrn = new Map<string, string | null>();
    if (pack?.scheduleTypeByCrn) {
      for (const [crn, st] of Object.entries(pack.scheduleTypeByCrn)) {
        scheduleTypeByCrn.set(crn, st ?? null);
      }
    }
    return filterCandidatesBySectionPins(base, pins, scheduleTypeByCrn);
  }
  if (item.anchorCrn == null) return [];
  if (item.selectionKind === "single_crn") {
    return [
      {
        selectionKind: "single_crn",
        anchorCrn: item.anchorCrn,
        linkedBundleId: null,
        crns: [item.anchorCrn],
      },
    ];
  }
  if (item.selectionKind === "linked_bundle" && item.linkedBundleId != null) {
    const members =
      bundleMembersMerged.get(item.linkedBundleId) ??
      (pack?.bundleMembersById[String(item.linkedBundleId)] ?? []);
    const sel: PlannerItemSelection = {
      selectionKind: "linked_bundle",
      anchorCrn: item.anchorCrn,
      linkedBundleId: item.linkedBundleId,
    };
    const crns = resolveDisplayCrnsSync(sel, members);
    return [
      {
        selectionKind: "linked_bundle",
        anchorCrn: item.anchorCrn,
        linkedBundleId: item.linkedBundleId,
        crns,
      },
    ];
  }
  return [];
}

/**
 * Pure client/in-memory solve using prefetched per-course packs (no DB).
 * Merges maps from all packs referenced by `items`.
 */
export function solveSchedulesFromPacks(
  items: PlannerItemRow[],
  packs: Record<string, CourseSolvePack>,
  opts: {
    requireOpenSections: boolean;
    blackoutIntervals?: TimeInterval[];
    maxSolutions?: number;
    timeoutMs?: number;
  },
): SolveSchedulesResult {
  if (items.length === 0) {
    return { solutions: [], capped: false, timedOut: false, itemOrder: [] };
  }

  const meetingsByCrn = new Map<string, TimeInterval[]>();
  const facultyByCrn = new Map<
    string,
    { displayName: string | null; primaryIndicator: boolean | null }[]
  >();
  const scheduleTypeByCrn = new Map<string, string | null>();
  const seatsByCrn = new Map<
    string,
    { seatsAvailable: number | null; openSection: boolean | null }
  >();
  const bundleMembersMerged = new Map<number, string[]>();

  const seenKeys = new Set<string>();
  for (const item of items) {
    const key = courseSolvePackCourseKey(item.subject, item.courseNumber);
    const p = packs[key];
    if (!p) continue;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    mergeIntoMeetingsMap(meetingsByCrn, p.meetingsByCrn);
    mergeIntoFacultyMap(facultyByCrn, p.facultyByCrn);
    mergeIntoScheduleMap(scheduleTypeByCrn, p.scheduleTypeByCrn);
    mergeIntoSeatsMap(seatsByCrn, p.seatsByCrn);
    mergeBundleMembers(bundleMembersMerged, p.bundleMembersById);
  }

  const candidateLists: ScheduleCandidate[][] = items.map((item) => {
    const key = courseSolvePackCourseKey(item.subject, item.courseNumber);
    return candidateListForPlannerItem(item, packs[key], bundleMembersMerged);
  });

  return runSolveSearch({
    items,
    candidateLists,
    meetingsByCrn,
    facultyByCrn,
    scheduleTypeByCrn,
    seatsByCrn,
    requireOpenSections: opts.requireOpenSections,
    blackoutIntervals: opts.blackoutIntervals,
    maxSolutions: opts.maxSolutions,
    timeoutMs: opts.timeoutMs,
  });
}

export function everyPlannerItemHasSolvePack(
  items: PlannerItemRow[],
  packs: Record<string, CourseSolvePack>,
): boolean {
  for (const item of items) {
    const key = courseSolvePackCourseKey(item.subject, item.courseNumber);
    if (!packs[key]) return false;
  }
  return true;
}
