/**
 * Soft time-of-day preferences that bias the schedule scorer toward weeks
 * the user prefers (no Fridays, late starts, free lunch hour, no nights).
 *
 * These are scored as soft penalties — a candidate with one violation can
 * still appear, just lower-ranked. Hard exclusion remains the job of
 * `blackouts`.
 */

const MIN_OF_DAY = 0;
const MAX_OF_DAY = 24 * 60;

export type ProtectLunchV1 = {
  /** Minutes from midnight (inclusive). Default 11:30 = 690. */
  start: number;
  /** Minutes from midnight (exclusive). Default 13:00 = 780. */
  end: number;
};

export type PlannerTimePrefsV1 = {
  v: 1;
  /** Penalize Friday meetings entirely. */
  noFridays?: boolean;
  /** Penalize meetings that start before this minute-of-day. */
  noBefore?: number;
  /** Penalize meetings that end after this minute-of-day. */
  noAfter?: number;
  /** Penalize meetings that overlap the lunch window. */
  protectLunch?: ProtectLunchV1;
};

export const EMPTY_TIME_PREFS: PlannerTimePrefsV1 = { v: 1 };

export const DEFAULT_PROTECT_LUNCH: ProtectLunchV1 = { start: 11 * 60 + 30, end: 13 * 60 };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function clampMinute(n: unknown, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  const r = Math.round(n);
  if (r < MIN_OF_DAY) return MIN_OF_DAY;
  if (r > MAX_OF_DAY) return MAX_OF_DAY;
  return r;
}

export function parseTimePrefs(raw: unknown): PlannerTimePrefsV1 {
  if (!isRecord(raw)) return EMPTY_TIME_PREFS;
  if (raw.v !== 1) return EMPTY_TIME_PREFS;
  const out: PlannerTimePrefsV1 = { v: 1 };
  if (raw.noFridays === true) out.noFridays = true;
  if (typeof raw.noBefore === "number" && Number.isFinite(raw.noBefore)) {
    out.noBefore = clampMinute(raw.noBefore, 0);
  }
  if (typeof raw.noAfter === "number" && Number.isFinite(raw.noAfter)) {
    out.noAfter = clampMinute(raw.noAfter, MAX_OF_DAY);
  }
  if (isRecord(raw.protectLunch)) {
    const start = clampMinute(raw.protectLunch.start, DEFAULT_PROTECT_LUNCH.start);
    const end = clampMinute(raw.protectLunch.end, DEFAULT_PROTECT_LUNCH.end);
    if (end > start) out.protectLunch = { start, end };
  }
  return out;
}

export function activeTimePrefsCount(p: PlannerTimePrefsV1): number {
  let n = 0;
  if (p.noFridays) n++;
  if (p.noBefore != null) n++;
  if (p.noAfter != null) n++;
  if (p.protectLunch) n++;
  return n;
}
