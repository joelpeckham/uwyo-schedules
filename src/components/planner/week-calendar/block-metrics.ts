/** Typography and padding derived from calendar block height (zoom level). */

export function formatHour(h: number): string {
  const ap = h >= 12 ? "p.m." : "a.m.";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ap}`;
}

export function calendarBlockPaddingPx(heightPx: number): number {
  return Math.min(6, Math.max(1, Math.round(heightPx * 0.06)));
}

export function calendarTitleFontPx(heightPx: number): number {
  return Math.min(11, Math.max(8, Math.round(heightPx * 0.2)));
}

/** How many secondary lines (instructor / location) fit at this zoom level. */
export function calendarSecondaryTier(
  heightPx: number,
): "none" | "one" | "both" {
  if (heightPx < 28) return "none";
  if (heightPx < 44) return "one";
  return "both";
}
