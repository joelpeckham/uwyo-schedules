/** Sat=5, Sun=6 per `DAY_FIELDS` in derive.ts */

import { PLANNER_GRID_DAY_INDICES } from "./constants";

const WEEKDAY_INDICES = [0, 1, 2, 3, 4] as const;
const FULL_WEEK_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

/** Interactive planner week grid always uses seven columns (no horizontal reflow). */
export function plannerGridDayIndices(): readonly number[] {
  return PLANNER_GRID_DAY_INDICES;
}

/**
 * Weekend columns with no course blocks or busy times are shown de-emphasized
 * until the user adds weekend content.
 */
export function isPlannerWeekendDayMuted(
  dayIndex: number,
  blocks: readonly { dayIndex: number }[],
  blackouts: readonly { dayIndex: number }[],
): boolean {
  if (dayIndex !== 5 && dayIndex !== 6) return false;
  const hasBlock = blocks.some((b) => b.dayIndex === dayIndex);
  const hasBusy = blackouts.some((b) => b.dayIndex === dayIndex);
  return !hasBlock && !hasBusy;
}

export function visibleDayIndicesForBlocks(
  blocks: readonly { dayIndex: number }[],
): readonly number[] {
  const hasSat = blocks.some((b) => b.dayIndex === 5);
  const hasSun = blocks.some((b) => b.dayIndex === 6);
  if (!hasSat && !hasSun) return WEEKDAY_INDICES;
  if (hasSat && hasSun) return FULL_WEEK_INDICES;
  if (hasSat) return [...WEEKDAY_INDICES, 5];
  return [...WEEKDAY_INDICES, 6];
}

/** Week columns when courses and/or busy blocks use weekend days. */
export function visibleDayIndicesMerged(
  blocks: readonly { dayIndex: number }[],
  blackouts: readonly { dayIndex: number }[],
): readonly number[] {
  const merged: { dayIndex: number }[] = [...blocks, ...blackouts];
  return visibleDayIndicesForBlocks(merged);
}
