/**
 * Scroll progress for offset ["start start", "end end"] (vertical axis).
 * Pure helper so we can drive the landing demo without Motion useScroll, which
 * is unreliable with sticky children on iOS (especially reverse scroll).
 */
export function computeTargetScrollProgress(
  targetHeightPx: number,
  targetTopPx: number,
  viewportHeightPx: number,
): number {
  const scrollable = targetHeightPx - viewportHeightPx;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, -targetTopPx / scrollable));
}
