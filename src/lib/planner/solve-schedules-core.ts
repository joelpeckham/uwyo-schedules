import type { PlannerItemRow } from "./data";
import type { InstructorPrefsV1 } from "./instructor-prefs";
import { parseInstructorPrefs } from "./instructor-prefs";
import type {
  PlannerItemSelection,
  ResolvedPlannerSelection,
} from "./resolve-display-crns-shared";
import { resolveDisplayCrnsSync } from "./resolve-display-crns-shared";
import { bannerClockToMinutes } from "./banner-time";
import {
  filterCandidatesBySectionPins,
  parseSectionPinsJson,
} from "./section-pins";
import { normalizeScheduleTypeKey } from "./swap-helpers";
import type { PlannerScheduleFilters } from "./schedule-filters";
import type { DeliveryMode } from "@/lib/sections/delivery-mode";
import { candidateViolatesDeliveryFilters } from "@/lib/sections/delivery-mode";

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

export const DEFAULT_MAX_SOLUTIONS = 1;
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
  deliveryModeByCrn: Record<string, DeliveryMode>;
};

function selectionFromCandidate(c: ScheduleCandidate): ResolvedPlannerSelection {
  return {
    selectionKind: c.selectionKind,
    anchorCrn: c.anchorCrn,
    linkedBundleId: c.linkedBundleId,
  };
}

function candidateMatchesResolvedSelection(
  c: ScheduleCandidate,
  s: ResolvedPlannerSelection,
): boolean {
  return (
    c.selectionKind === s.selectionKind &&
    c.anchorCrn === s.anchorCrn &&
    c.linkedBundleId === s.linkedBundleId
  );
}

/** Exported for tests: whether `single_crn` alone is a valid registration for this CRN. */
export function eligibleForStandaloneSingleCrn(
  crn: string,
  linkedNonAnchorMemberCrns: ReadonlySet<string>,
): boolean {
  return !linkedNonAnchorMemberCrns.has(crn);
}

/**
 * Tokenize a name on non-alphanumeric boundaries. Keeps lowercased tokens of
 * length >= 1 (e.g. "Dr. Jane M. Smith-Jones" -> ["dr","jane","m","smith","jones"]).
 */
function tokenizeName(s: string): string[] {
  const out: string[] = [];
  for (const part of s.toLowerCase().split(/[^a-z0-9]+/)) {
    if (part.length > 0) out.push(part);
  }
  return out;
}

/**
 * True when every pref token has a faculty-name token that starts with it
 * (case-insensitive, alphanumeric tokens). This replaces the old bidirectional
 * `includes` matcher that false-positived on short common substrings (e.g.
 * "smith" matching "blacksmith") and false-negatived when the user typed in
 * a different name order.
 */
function prefMatchesFacultyName(pref: string, facultyName: string): boolean {
  const prefTokens = tokenizeName(pref);
  if (prefTokens.length === 0) return false;
  const nameTokens = tokenizeName(facultyName);
  if (nameTokens.length === 0) return false;
  for (const pt of prefTokens) {
    let found = false;
    for (const nt of nameTokens) {
      if (nt.startsWith(pt)) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

/** True if at least one non-empty pref matches some faculty name (bidirectional includes, case-insensitive). */
function facultyMatchesAnyListedPref(
  prefs: string[],
  facultyNames: (string | null)[],
): boolean {
  const names = facultyNames
    .map((n) => (n ?? "").trim())
    .filter((n) => n.length > 0);
  if (names.length === 0 || prefs.length === 0) return false;
  for (const p of prefs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    for (const n of names) {
      if (prefMatchesFacultyName(trimmed, n)) return true;
    }
  }
  return false;
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
    if (!facultyMatchesAnyListedPref(primaryPrefs, pool)) return true;
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
        if (!facultyMatchesAnyListedPref(typePrefs, pool)) return true;
      }
    }
  }

  return false;
}

/** Stable lexicographic key for deterministic solution ordering. */
function solutionSortKey(solution: ScheduleSolution): string {
  return Object.values(solution.selections)
    .map((s) => s.anchorCrn)
    .sort()
    .join(",");
}

/**
 * True only when every CRN has a known seat row that proves the section is
 * open. A missing seat row is treated as **closed** so that incomplete packs
 * cannot silently bypass the `requireOpenSections` constraint (P0 #3).
 */
export function allCrnsHaveOpenSeats(
  crns: string[],
  seatsByCrn: Map<string, { seatsAvailable: number | null; openSection: boolean | null }>,
): boolean {
  for (const crn of crns) {
    const row = seatsByCrn.get(crn);
    if (!row) return false;
    if (row.seatsAvailable != null && row.seatsAvailable <= 0) return false;
    if (row.openSection === false) return false;
  }
  return true;
}

export type SolveSchedulesResult = {
  solutions: ScheduleSolution[];
  /**
   * True when DFS hit `maxSolutions` and at least one further candidate
   * was skipped — i.e. additional solutions might exist beyond the returned
   * set. The planner intentionally requests `maxSolutions = 1` for the
   * interactive view, so consumers should ignore this flag unless they are
   * paginating solutions.
   */
  capped: boolean;
  timedOut: boolean;
  itemOrder: number[];
};

function mergeIntoMeetingsMap(
  target: Map<string, TimeInterval[]>,
  from: Record<string, TimeInterval[]>,
): void {
  for (const [k, v] of Object.entries(from)) {
    if (target.has(k)) {
      if (
        process.env.NODE_ENV === "development" &&
        JSON.stringify(target.get(k)) !== JSON.stringify(v)
      ) {
        console.warn(
          `[solve-pack] merge conflict for meetings CRN ${k}; keeping first pack`,
        );
      }
      continue;
    }
    target.set(k, v);
  }
}

function mergeIntoFacultyMap(
  target: Map<string, { displayName: string | null; primaryIndicator: boolean | null }[]>,
  from: CourseSolvePack["facultyByCrn"],
): void {
  for (const [k, v] of Object.entries(from)) {
    if (target.has(k)) {
      if (
        process.env.NODE_ENV === "development" &&
        JSON.stringify(target.get(k)) !== JSON.stringify(v)
      ) {
        console.warn(
          `[solve-pack] merge conflict for faculty CRN ${k}; keeping first pack`,
        );
      }
      continue;
    }
    target.set(k, v);
  }
}

function mergeIntoScheduleMap(
  target: Map<string, string | null>,
  from: Record<string, string | null>,
): void {
  for (const [k, v] of Object.entries(from)) {
    if (target.has(k)) {
      if (process.env.NODE_ENV === "development" && target.get(k) !== v) {
        console.warn(
          `[solve-pack] merge conflict for schedule type CRN ${k}; keeping first pack`,
        );
      }
      continue;
    }
    target.set(k, v);
  }
}

function mergeIntoSeatsMap(
  target: Map<string, { seatsAvailable: number | null; openSection: boolean | null }>,
  from: CourseSolvePack["seatsByCrn"],
): void {
  for (const [k, v] of Object.entries(from)) {
    if (target.has(k)) {
      if (
        process.env.NODE_ENV === "development" &&
        JSON.stringify(target.get(k)) !== JSON.stringify(v)
      ) {
        console.warn(
          `[solve-pack] merge conflict for seats CRN ${k}; keeping first pack`,
        );
      }
      continue;
    }
    target.set(k, v);
  }
}

function mergeIntoDeliveryMap(
  target: Map<string, DeliveryMode>,
  from: Record<string, DeliveryMode> | undefined,
): void {
  if (!from) return;
  for (const [k, v] of Object.entries(from)) {
    if (target.has(k)) {
      if (process.env.NODE_ENV === "development" && target.get(k) !== v) {
        console.warn(
          `[solve-pack] merge conflict for delivery mode CRN ${k}; keeping first pack`,
        );
      }
      continue;
    }
    target.set(k, v);
  }
}

export type SolveScheduleFilterOpts = Pick<
  PlannerScheduleFilters,
  "requireOpenSections" | "excludeTba" | "excludeOnlineAsync"
>;

function mergeBundleMembers(
  target: Map<number, string[]>,
  from: Record<string, string[]>,
): void {
  for (const [idStr, members] of Object.entries(from)) {
    const id = Number(idStr);
    if (!Number.isFinite(id)) continue;
    if (target.has(id)) {
      if (
        process.env.NODE_ENV === "development" &&
        JSON.stringify(target.get(id)) !== JSON.stringify(members)
      ) {
        console.warn(
          `[solve-pack] merge conflict for bundle members id ${id}; keeping first pack`,
        );
      }
      continue;
    }
    target.set(id, members);
  }
}

/**
 * For a sorted-by-(dayIndex, start) interval list, check whether any pair
 * overlaps. O(n) given sorted input.
 */
function sortedHasInternalOverlap(intervals: TimeInterval[]): boolean {
  for (let i = 1; i < intervals.length; i++) {
    const prev = intervals[i - 1]!;
    const curr = intervals[i]!;
    if (prev.dayIndex === curr.dayIndex && curr.start < prev.end) return true;
  }
  return false;
}

function intervalSortCmp(a: TimeInterval, b: TimeInterval): number {
  if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
  return a.start - b.start;
}

/**
 * Compare two interval lists (each sorted by dayIndex, start). Returns true
 * if any interval in `a` overlaps any interval in `b`. O(n + m).
 */
function sortedAnyOverlap(
  a: TimeInterval[],
  b: TimeInterval[],
): boolean {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ai = a[i]!;
    const bj = b[j]!;
    if (ai.dayIndex < bj.dayIndex) {
      i++;
      continue;
    }
    if (ai.dayIndex > bj.dayIndex) {
      j++;
      continue;
    }
    if (ai.start < bj.end && bj.start < ai.end) return true;
    if (ai.end <= bj.end) i++;
    else j++;
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
  deliveryModeByCrn: Map<string, DeliveryMode>;
  requireOpenSections: boolean;
  excludeTba: boolean;
  excludeOnlineAsync: boolean;
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
    deliveryModeByCrn,
    requireOpenSections,
    excludeTba,
    excludeOnlineAsync,
  } = params;
  const deliveryFilters = { excludeTba, excludeOnlineAsync };
  const blackoutIntervalsRaw = params.blackoutIntervals ?? [];
  const blackoutIntervals = blackoutIntervalsRaw.slice().sort(intervalSortCmp);
  const maxSolutions = params.maxSolutions ?? DEFAULT_MAX_SOLUTIONS;
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = Date.now();

  const indices = items.map((_, i) => i);
  indices.sort(
    (a, b) => candidateLists[a]!.length - candidateLists[b]!.length,
  );

  const solutions: ScheduleSolution[] = [];
  let capped = false;
  let timedOut = false;

  const chosen: (ScheduleCandidate | null)[] = items.map(() => null);
  // Parse each row's instructor preferences once so the DFS leaves and the
  // hard-prefs filter inside the inner loop don't re-parse JSON for every
  // candidate considered.
  const prefsByItemIndex = items.map((it) => parseInstructorPrefs(it.instructorPrefs));

  // Precompute the flat, sorted interval list per candidate so the inner loop
  // doesn't re-flatten / re-sort meetings on every visit. Candidates whose
  // own meetings already self-overlap (or hit a blackout) are dropped here so
  // the DFS never even considers them.
  const candidateIntervalsCache = new WeakMap<ScheduleCandidate, TimeInterval[]>();
  function intervalsForCandidate(cand: ScheduleCandidate): TimeInterval[] | null {
    const cached = candidateIntervalsCache.get(cand);
    if (cached) return cached;
    const flat: TimeInterval[] = [];
    for (const crn of cand.crns) {
      const ivs = meetingsByCrn.get(crn);
      if (!ivs) continue;
      for (const iv of ivs) flat.push(iv);
    }
    flat.sort(intervalSortCmp);
    if (sortedHasInternalOverlap(flat)) return null;
    if (
      blackoutIntervals.length > 0 &&
      sortedAnyOverlap(flat, blackoutIntervals)
    ) {
      return null;
    }
    candidateIntervalsCache.set(cand, flat);
    return flat;
  }

  /**
   * Persistent interval stack mirroring the union of `chosen` candidates'
   * meeting intervals (sorted). DFS pushes a candidate's intervals before
   * recursing and pops them on the way back, so we never re-flatten.
   */
  const accIntervals: TimeInterval[] = [];

  function pushSorted(intervals: TimeInterval[]): void {
    if (accIntervals.length === 0) {
      for (const iv of intervals) accIntervals.push(iv);
      return;
    }
    const merged: TimeInterval[] = [];
    let i = 0;
    let j = 0;
    while (i < accIntervals.length && j < intervals.length) {
      if (intervalSortCmp(accIntervals[i]!, intervals[j]!) <= 0) {
        merged.push(accIntervals[i]!);
        i++;
      } else {
        merged.push(intervals[j]!);
        j++;
      }
    }
    while (i < accIntervals.length) merged.push(accIntervals[i++]!);
    while (j < intervals.length) merged.push(intervals[j++]!);
    accIntervals.length = 0;
    for (const iv of merged) accIntervals.push(iv);
  }

  function popIntervals(intervals: TimeInterval[]): void {
    if (intervals.length === 0) return;
    const removeSet = new Set<TimeInterval>(intervals);
    let writeIdx = 0;
    for (let readIdx = 0; readIdx < accIntervals.length; readIdx++) {
      const iv = accIntervals[readIdx]!;
      if (removeSet.has(iv)) {
        removeSet.delete(iv);
        continue;
      }
      accIntervals[writeIdx++] = iv;
    }
    accIntervals.length = writeIdx;
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
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const c = chosen[i]!;
        selections[item.id] = selectionFromCandidate(c);
      }
      solutions.push({ score: 0, selections });
      return;
    }

    const itemIndex = indices[depth]!;
    const list = candidateLists[itemIndex]!;
    const itemPrefs = prefsByItemIndex[itemIndex]!;

    for (const cand of list) {
      if (Date.now() - started > timeoutMs) {
        timedOut = true;
        return;
      }
      if (requireOpenSections && !allCrnsHaveOpenSeats(cand.crns, seatsByCrn)) {
        continue;
      }
      if (
        candidateViolatesDeliveryFilters(
          cand.crns,
          deliveryModeByCrn,
          deliveryFilters,
        )
      ) {
        continue;
      }
      if (
        candidateViolatesHardInstructorPrefs(
          cand,
          itemPrefs,
          facultyByCrn,
          scheduleTypeByCrn,
        )
      ) {
        continue;
      }
      const candIntervals = intervalsForCandidate(cand);
      if (candIntervals === null) continue;
      if (sortedAnyOverlap(accIntervals, candIntervals)) continue;

      chosen[itemIndex] = cand;
      pushSorted(candIntervals);
      dfs(depth + 1);
      popIntervals(candIntervals);
      chosen[itemIndex] = null;

      if (capped || timedOut) return;
    }
  }

  dfs(0);

  solutions.sort((a, b) =>
    solutionSortKey(a).localeCompare(solutionSortKey(b)),
  );

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

function mergePackMapsForSolve(
  items: PlannerItemRow[],
  packs: Record<string, CourseSolvePack>,
): {
  meetingsByCrn: Map<string, TimeInterval[]>;
  facultyByCrn: Map<
    string,
    { displayName: string | null; primaryIndicator: boolean | null }[]
  >;
  scheduleTypeByCrn: Map<string, string | null>;
  seatsByCrn: Map<
    string,
    { seatsAvailable: number | null; openSection: boolean | null }
  >;
  deliveryModeByCrn: Map<string, DeliveryMode>;
  bundleMembersMerged: Map<number, string[]>;
} {
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
  const deliveryModeByCrn = new Map<string, DeliveryMode>();
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
    mergeIntoDeliveryMap(deliveryModeByCrn, p.deliveryModeByCrn);
    mergeBundleMembers(bundleMembersMerged, p.bundleMembersById);
  }

  return {
    meetingsByCrn,
    facultyByCrn,
    scheduleTypeByCrn,
    seatsByCrn,
    deliveryModeByCrn,
    bundleMembersMerged,
  };
}

function sortCandidateListsPreferPrevious(
  items: PlannerItemRow[],
  lists: ScheduleCandidate[][],
  previousSelections: Record<number, ResolvedPlannerSelection> | null | undefined,
): ScheduleCandidate[][] {
  if (!previousSelections) return lists;
  return lists.map((list, i) => {
    const id = items[i]!.id;
    const pref = previousSelections[id];
    if (!pref) return list;
    return [...list].sort((a, b) => {
      const am = candidateMatchesResolvedSelection(a, pref) ? 0 : 1;
      const bm = candidateMatchesResolvedSelection(b, pref) ? 0 : 1;
      return am - bm;
    });
  });
}

/**
 * True if every row still has its prior selection among current candidates and
 * the combined assignment has no meeting overlap or blackout conflicts.
 */
export function scheduleSolutionStillValidForItems(
  items: PlannerItemRow[],
  packs: Record<string, CourseSolvePack>,
  solution: ScheduleSolution,
  opts: SolveScheduleFilterOpts & {
    blackoutIntervals?: TimeInterval[];
  },
): boolean {
  if (items.length === 0) return true;
  if (!everyPlannerItemHasSolvePack(items, packs)) return false;

  const {
    meetingsByCrn,
    facultyByCrn,
    scheduleTypeByCrn,
    seatsByCrn,
    deliveryModeByCrn,
    bundleMembersMerged,
  } = mergePackMapsForSolve(items, packs);

  const deliveryFilters = {
    excludeTba: opts.excludeTba,
    excludeOnlineAsync: opts.excludeOnlineAsync,
  };
  const blackoutIntervals = opts.blackoutIntervals ?? [];
  const chosen: ScheduleCandidate[] = [];

  for (const item of items) {
    const sel = solution.selections[item.id];
    if (!sel) return false;
    const key = courseSolvePackCourseKey(item.subject, item.courseNumber);
    const list = candidateListForPlannerItem(
      item,
      packs[key],
      bundleMembersMerged,
    );
    const cand = list.find((c) => candidateMatchesResolvedSelection(c, sel));
    if (!cand) return false;
    if (
      opts.requireOpenSections &&
      !allCrnsHaveOpenSeats(cand.crns, seatsByCrn)
    ) {
      return false;
    }
    if (
      candidateViolatesDeliveryFilters(
        cand.crns,
        deliveryModeByCrn,
        deliveryFilters,
      )
    ) {
      return false;
    }
    if (
      candidateViolatesHardInstructorPrefs(
        cand,
        parseInstructorPrefs(item.instructorPrefs),
        facultyByCrn,
        scheduleTypeByCrn,
      )
    ) {
      return false;
    }
    chosen.push(cand);
  }

  const acc: TimeInterval[] = [];
  for (const cand of chosen) {
    for (const crn of cand.crns) {
      acc.push(...(meetingsByCrn.get(crn) ?? []));
    }
  }
  if (hasAnyOverlap(acc)) return false;
  for (const b of blackoutIntervals) {
    for (const iv of acc) {
      if (intervalsOverlap(iv, b)) return false;
    }
  }
  return true;
}

/**
 * Pure client/in-memory solve using prefetched per-course packs (no DB).
 * Merges maps from all packs referenced by `items`.
 */
export function solveSchedulesFromPacks(
  items: PlannerItemRow[],
  packs: Record<string, CourseSolvePack>,
  opts: SolveScheduleFilterOpts & {
    blackoutIntervals?: TimeInterval[];
    maxSolutions?: number;
    timeoutMs?: number;
    /** Prefer DFS leaves that keep these per-item selections when still feasible. */
    previousSelections?: Record<number, ResolvedPlannerSelection> | null;
  },
): SolveSchedulesResult {
  if (items.length === 0) {
    return { solutions: [], capped: false, timedOut: false, itemOrder: [] };
  }

  const {
    meetingsByCrn,
    facultyByCrn,
    scheduleTypeByCrn,
    seatsByCrn,
    deliveryModeByCrn,
    bundleMembersMerged,
  } = mergePackMapsForSolve(items, packs);

  const rawLists: ScheduleCandidate[][] = items.map((item) => {
    const key = courseSolvePackCourseKey(item.subject, item.courseNumber);
    return candidateListForPlannerItem(item, packs[key], bundleMembersMerged);
  });
  const candidateLists = sortCandidateListsPreferPrevious(
    items,
    rawLists,
    opts.previousSelections,
  );

  return runSolveSearch({
    items,
    candidateLists,
    meetingsByCrn,
    facultyByCrn,
    scheduleTypeByCrn,
    seatsByCrn,
    deliveryModeByCrn,
    requireOpenSections: opts.requireOpenSections,
    excludeTba: opts.excludeTba,
    excludeOnlineAsync: opts.excludeOnlineAsync,
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

/**
 * Tri-state feasibility for `items`:
 * - `"feasible"` — at least one global schedule exists in the current pack data.
 * - `"infeasible"` — packs are complete and DFS proved no global schedule exists.
 * - `"unknown"` — at least one course pack is missing; the caller must decide
 *   how to handle it (typically allow the action and re-check after prefetch).
 *
 * Replaces the old boolean shape that conflated "feasible" and "unknown".
 */
type PlannerFeasibility = "feasible" | "infeasible" | "unknown";

export function plannerItemsFeasibility(
  items: PlannerItemRow[],
  packs: Record<string, CourseSolvePack>,
  opts: SolveScheduleFilterOpts & {
    blackoutIntervals?: TimeInterval[];
    maxSolutions?: number;
    /**
     * Tight upper bound for synchronous UX gates (toggle/drag/pin). When the
     * solver hits this we return `"unknown"` so the caller can let the
     * preview through and rely on the next full recalc for the verdict —
     * never block a user action on a slow probe.
     */
    timeoutMs?: number;
  },
): PlannerFeasibility {
  if (items.length === 0) return "feasible";
  if (!everyPlannerItemHasSolvePack(items, packs)) return "unknown";
  const result = solveSchedulesFromPacks(items, packs, {
    requireOpenSections: opts.requireOpenSections,
    excludeTba: opts.excludeTba,
    excludeOnlineAsync: opts.excludeOnlineAsync,
    blackoutIntervals: opts.blackoutIntervals ?? [],
    maxSolutions: opts.maxSolutions ?? DEFAULT_MAX_SOLUTIONS,
    timeoutMs: opts.timeoutMs,
  });
  if (result.solutions.length > 0) return "feasible";
  return result.timedOut ? "unknown" : "infeasible";
}

/**
 * Batch feasibility for an unresolved item's `scheduleTypeKey` pin: returns
 * the subset of `candidatePinCrns` for which a complete schedule still exists.
 *
 * Compared to running `plannerItemsFeasibility` once per ghost CRN this:
 *   - merges constraint maps once instead of N times,
 *   - builds non-dragged candidate lists once,
 *   - reuses interval intersection precomputation,
 *   - early-exits the dragged-item DFS layer when every CRN has a witness.
 *
 * Returns `null` when the dragged row is missing its pack ("unknown").
 */
export function feasibleSinglePinChoicesForDrag(
  items: PlannerItemRow[],
  packs: Record<string, CourseSolvePack>,
  draggedItemId: number,
  scheduleTypeKey: string,
  candidatePinCrns: readonly string[],
  opts: SolveScheduleFilterOpts & {
    blackoutIntervals?: TimeInterval[];
    timeoutMs?: number;
  },
): Set<string> | null {
  if (candidatePinCrns.length === 0) return new Set();
  if (!everyPlannerItemHasSolvePack(items, packs)) return null;

  const draggedIdx = items.findIndex((r) => r.id === draggedItemId);
  if (draggedIdx < 0) return new Set();
  const draggedItem = items[draggedIdx]!;
  if (draggedItem.selectionKind !== "unresolved") return new Set();

  const targetCrnSet = new Set(candidatePinCrns);
  const remainingCrns = new Set(candidatePinCrns);

  const {
    meetingsByCrn,
    facultyByCrn,
    scheduleTypeByCrn,
    seatsByCrn,
    deliveryModeByCrn,
    bundleMembersMerged,
  } = mergePackMapsForSolve(items, packs);

  const requireOpenSections = opts.requireOpenSections;
  const deliveryFilters = {
    excludeTba: opts.excludeTba,
    excludeOnlineAsync: opts.excludeOnlineAsync,
  };
  const blackoutIntervalsRaw = opts.blackoutIntervals ?? [];
  const blackoutIntervals = blackoutIntervalsRaw.slice().sort(intervalSortCmp);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Candidate lists for non-dragged items use their existing pins; the
  // dragged item is special-cased below with a per-pin filtered list.
  const otherIdxs: number[] = [];
  const otherCandidates: ScheduleCandidate[][] = [];
  for (let i = 0; i < items.length; i++) {
    if (i === draggedIdx) continue;
    otherIdxs.push(i);
    otherCandidates.push(
      candidateListForPlannerItem(
        items[i]!,
        packs[
          courseSolvePackCourseKey(items[i]!.subject, items[i]!.courseNumber)
        ],
        bundleMembersMerged,
      ),
    );
  }
  // Cheapest-first DFS over the non-dragged items.
  const orderedOtherIdxOrder = otherIdxs
    .map((_, k) => k)
    .sort((a, b) => otherCandidates[a]!.length - otherCandidates[b]!.length);

  const draggedPack =
    packs[
      courseSolvePackCourseKey(draggedItem.subject, draggedItem.courseNumber)
    ];
  if (!draggedPack) return null;

  // Group the dragged item's full candidate list by which pin CRN they would
  // resolve at `scheduleTypeKey`. Only candidates whose pin CRN is in the
  // requested set survive; we test them grouped so we can stop probing a
  // pin CRN as soon as we find any feasible completion for it.
  const draggedCandidatesByPin = new Map<string, ScheduleCandidate[]>();
  const basePins = parseSectionPinsJson(draggedItem.sectionPins);
  for (const cand of draggedPack.candidates) {
    let pinCrn: string | null = null;
    for (const crn of cand.crns) {
      if (
        normalizeScheduleTypeKey(scheduleTypeByCrn.get(crn) ?? null) ===
        scheduleTypeKey
      ) {
        pinCrn = crn;
        break;
      }
    }
    if (pinCrn === null || !targetCrnSet.has(pinCrn)) continue;
    let mismatch = false;
    for (const [otherKey, otherCrn] of Object.entries(basePins.byType)) {
      if (otherKey === scheduleTypeKey) continue;
      if (!cand.crns.includes(otherCrn)) {
        mismatch = true;
        break;
      }
    }
    if (mismatch) continue;
    let bucket = draggedCandidatesByPin.get(pinCrn);
    if (!bucket) {
      bucket = [];
      draggedCandidatesByPin.set(pinCrn, bucket);
    }
    bucket.push(cand);
  }

  if (draggedCandidatesByPin.size === 0) return new Set();

  const feasible = new Set<string>();

  const candidateIntervalsCache = new WeakMap<ScheduleCandidate, TimeInterval[]>();
  function intervalsForCandidate(cand: ScheduleCandidate): TimeInterval[] | null {
    const cached = candidateIntervalsCache.get(cand);
    if (cached) return cached;
    const flat: TimeInterval[] = [];
    for (const crn of cand.crns) {
      const ivs = meetingsByCrn.get(crn);
      if (!ivs) continue;
      for (const iv of ivs) flat.push(iv);
    }
    flat.sort(intervalSortCmp);
    if (sortedHasInternalOverlap(flat)) return null;
    if (
      blackoutIntervals.length > 0 &&
      sortedAnyOverlap(flat, blackoutIntervals)
    ) {
      return null;
    }
    candidateIntervalsCache.set(cand, flat);
    return flat;
  }

  const accIntervals: TimeInterval[] = [];
  function pushSorted(intervals: TimeInterval[]): void {
    if (accIntervals.length === 0) {
      for (const iv of intervals) accIntervals.push(iv);
      return;
    }
    const merged: TimeInterval[] = [];
    let i = 0;
    let j = 0;
    while (i < accIntervals.length && j < intervals.length) {
      if (intervalSortCmp(accIntervals[i]!, intervals[j]!) <= 0) {
        merged.push(accIntervals[i]!);
        i++;
      } else {
        merged.push(intervals[j]!);
        j++;
      }
    }
    while (i < accIntervals.length) merged.push(accIntervals[i++]!);
    while (j < intervals.length) merged.push(intervals[j++]!);
    accIntervals.length = 0;
    for (const iv of merged) accIntervals.push(iv);
  }
  function popIntervals(intervals: TimeInterval[]): void {
    if (intervals.length === 0) return;
    const removeSet = new Set<TimeInterval>(intervals);
    let writeIdx = 0;
    for (let readIdx = 0; readIdx < accIntervals.length; readIdx++) {
      const iv = accIntervals[readIdx]!;
      if (removeSet.has(iv)) {
        removeSet.delete(iv);
        continue;
      }
      accIntervals[writeIdx++] = iv;
    }
    accIntervals.length = writeIdx;
  }

  const started = Date.now();
  let timedOut = false;

  function tryPin(pinCrn: string, bucket: ScheduleCandidate[]): boolean {
    for (const cand of bucket) {
      if (Date.now() - started > timeoutMs) {
        timedOut = true;
        return false;
      }
      if (
        requireOpenSections &&
        !allCrnsHaveOpenSeats(cand.crns, seatsByCrn)
      ) {
        continue;
      }
      if (
        candidateViolatesDeliveryFilters(
          cand.crns,
          deliveryModeByCrn,
          deliveryFilters,
        )
      ) {
        continue;
      }
      if (
        candidateViolatesHardInstructorPrefs(
          cand,
          parseInstructorPrefs(draggedItem.instructorPrefs),
          facultyByCrn,
          scheduleTypeByCrn,
        )
      ) {
        continue;
      }
      const candIntervals = intervalsForCandidate(cand);
      if (candIntervals === null) continue;
      if (sortedAnyOverlap(accIntervals, candIntervals)) continue;
      pushSorted(candIntervals);
      const found = dfsOthers(0);
      popIntervals(candIntervals);
      if (timedOut) return false;
      if (found) return true;
    }
    return false;
  }

  function dfsOthers(orderIdx: number): boolean {
    if (orderIdx === orderedOtherIdxOrder.length) return true;
    if (Date.now() - started > timeoutMs) {
      timedOut = true;
      return false;
    }
    const k = orderedOtherIdxOrder[orderIdx]!;
    const otherItem = items[otherIdxs[k]!]!;
    const list = otherCandidates[k]!;
    const itemPrefs = parseInstructorPrefs(otherItem.instructorPrefs);
    for (const cand of list) {
      if (Date.now() - started > timeoutMs) {
        timedOut = true;
        return false;
      }
      if (
        requireOpenSections &&
        !allCrnsHaveOpenSeats(cand.crns, seatsByCrn)
      ) {
        continue;
      }
      if (
        candidateViolatesDeliveryFilters(
          cand.crns,
          deliveryModeByCrn,
          deliveryFilters,
        )
      ) {
        continue;
      }
      if (
        candidateViolatesHardInstructorPrefs(
          cand,
          itemPrefs,
          facultyByCrn,
          scheduleTypeByCrn,
        )
      ) {
        continue;
      }
      const candIntervals = intervalsForCandidate(cand);
      if (candIntervals === null) continue;
      if (sortedAnyOverlap(accIntervals, candIntervals)) continue;
      pushSorted(candIntervals);
      const found = dfsOthers(orderIdx + 1);
      popIntervals(candIntervals);
      if (timedOut) return false;
      if (found) return true;
    }
    return false;
  }

  // Test pin CRNs in the order they were requested. As soon as any single
  // candidate for that pin produces a complete schedule we mark it feasible
  // and move on to the next pin.
  for (const pinCrn of candidatePinCrns) {
    if (!remainingCrns.has(pinCrn)) continue;
    const bucket = draggedCandidatesByPin.get(pinCrn);
    if (!bucket || bucket.length === 0) {
      remainingCrns.delete(pinCrn);
      continue;
    }
    if (tryPin(pinCrn, bucket)) feasible.add(pinCrn);
    remainingCrns.delete(pinCrn);
    if (timedOut) break;
  }

  return feasible;
}

