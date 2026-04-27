import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
} from "./constants";
import type { TimeInterval } from "./solve-schedules-core";

const DAY_MIN = 0;
const DAY_MAX = 6;
const SNAP_MINUTES = 15;
const MIN_DURATION_MINUTES = 30;

export type PlannerBlackoutItemV1 = {
  id: string;
  dayIndex: number;
  start: number;
  end: number;
  label?: string;
};

export type PlannerBlackoutsDocV1 = {
  v: 1;
  items: PlannerBlackoutItemV1[];
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isValidId(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= 128;
}

/** Parse DB jsonb into normalized v1 doc; invalid → empty items. */
export function parseBlackoutsJson(raw: unknown): PlannerBlackoutsDocV1 {
  if (!isRecord(raw)) return { v: 1, items: [] };
  if (raw.v !== 1) return { v: 1, items: [] };
  const itemsRaw = raw.items;
  if (!Array.isArray(itemsRaw)) return { v: 1, items: [] };
  const items: PlannerBlackoutItemV1[] = [];
  for (const el of itemsRaw) {
    if (!isRecord(el)) continue;
    if (!isValidId(el.id)) continue;
    const dayIndex = el.dayIndex;
    const start = el.start;
    const end = el.end;
    if (
      typeof dayIndex !== "number" ||
      !Number.isInteger(dayIndex) ||
      dayIndex < DAY_MIN ||
      dayIndex > DAY_MAX
    ) {
      continue;
    }
    if (typeof start !== "number" || typeof end !== "number") continue;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (end <= start) continue;
    const label =
      typeof el.label === "string" ? el.label.trim().slice(0, 80) : undefined;
    const clamped = clampInterval({
      dayIndex,
      start,
      end,
      label: label || undefined,
    });
    if (clamped.end - clamped.start < MIN_DURATION_MINUTES) continue;
    items.push({
      id: el.id as string,
      dayIndex: clamped.dayIndex,
      start: clamped.start,
      end: clamped.end,
      label: clamped.label,
    });
  }
  return { v: 1, items };
}

export function blackoutsDocToTimeIntervals(doc: PlannerBlackoutsDocV1): TimeInterval[] {
  return doc.items.map((i) => ({
    dayIndex: i.dayIndex,
    start: i.start,
    end: i.end,
  }));
}

const CAL_MIN = CALENDAR_START_HOUR * 60;
/** Exclusive upper bound for last displayed hour (23:59 end of day row). */
const CAL_MAX = (CALENDAR_END_HOUR + 1) * 60;

export function clampInterval(
  input: Omit<PlannerBlackoutItemV1, "id">,
): Omit<PlannerBlackoutItemV1, "id"> {
  const dayIndex = Math.min(DAY_MAX, Math.max(DAY_MIN, Math.floor(input.dayIndex)));
  const start = Math.max(CAL_MIN, Math.min(input.start, CAL_MAX));
  let end = Math.max(CAL_MIN, Math.min(input.end, CAL_MAX));
  if (end <= start) end = Math.min(CAL_MAX, start + MIN_DURATION_MINUTES);
  return {
    dayIndex,
    start,
    end,
    label: input.label,
  };
}

function snapMinutes(n: number): number {
  return Math.round(n / SNAP_MINUTES) * SNAP_MINUTES;
}

export function snapIntervalEndpoints(start: number, end: number): { start: number; end: number } {
  const s = snapMinutes(start);
  let e = snapMinutes(end);
  if (e <= s) e = s + SNAP_MINUTES;
  return { start: s, end: e };
}

export function stableBlackoutsJsonForDb(doc: PlannerBlackoutsDocV1): unknown {
  return {
    v: 1 as const,
    items: doc.items.map((i) => ({
      id: i.id,
      dayIndex: i.dayIndex,
      start: i.start,
      end: i.end,
      ...(i.label ? { label: i.label } : {}),
    })),
  };
}

/** Max blackout rows per term (DoS / payload guard). */
export const MAX_PLANNER_BLACKOUTS = 50;

/** Normalize client-submitted items array for persistence. */
export function parseBlackoutsItemsArray(items: unknown): PlannerBlackoutsDocV1 {
  if (!Array.isArray(items)) return { v: 1, items: [] };
  const slice = items.slice(0, MAX_PLANNER_BLACKOUTS);
  return parseBlackoutsJson({ v: 1, items: slice });
}
