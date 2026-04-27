/** Sat=5, Sun=6 per `DAY_FIELDS` in derive.ts */

const WEEKDAY_INDICES = [0, 1, 2, 3, 4] as const;
const FULL_WEEK_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

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
