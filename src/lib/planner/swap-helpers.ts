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

type LinkedBundleOptionPick = {
  id: number;
  bundleIndex: number;
  memberCrns: string[];
};

/**
 * Prefer the bundle whose anchor+members overlap most with current CRNs;
 * tie-break lower bundleIndex.
 */
export function pickBestLinkedBundleId(
  anchorCrn: string,
  options: LinkedBundleOptionPick[],
  currentDisplayCrns: string[],
): number | null {
  if (options.length === 0) return null;
  const current = new Set(currentDisplayCrns);
  let bestId: number | null = null;
  let bestScore = -1;
  let bestBundleIndex = Infinity;
  for (const opt of options) {
    const full = new Set<string>([anchorCrn, ...opt.memberCrns]);
    let score = 0;
    for (const c of full) {
      if (current.has(c)) score++;
    }
    if (
      score > bestScore ||
      (score === bestScore && opt.bundleIndex < bestBundleIndex)
    ) {
      bestScore = score;
      bestBundleIndex = opt.bundleIndex;
      bestId = opt.id;
    }
  }
  return bestId;
}
