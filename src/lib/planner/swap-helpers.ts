/**
 * Calendar swap-by-drag: normalize Banner strings and pick a linked bundle.
 * Odd scheduleTypeDescription values may not match cleanly; normalization is best-effort.
 */

/** Trim + lowercase for case-insensitive section scheduleTypeDescription equality. */
export function normalizeScheduleTypeKey(
  s: string | null | undefined,
): string {
  return (s ?? "").trim().toLowerCase();
}

/** Uppercase + trim; null if empty. */
export function normalizeMeetingScheduleType(
  s: string | null | undefined,
): string | null {
  const t = (s ?? "").trim().toUpperCase();
  return t.length > 0 ? t : null;
}
