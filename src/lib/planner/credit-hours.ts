import type { CalendarBlock, PlannerItemRow } from "./data";

type CreditFields = {
  creditHours: number | null;
  creditHourLow?: number | null;
  creditHourHigh?: number | null;
  creditHourIndicator?: string | null;
};

type SectionWithCredits = CreditFields & { crn: string };

function hasCreditIndicator(indicator: string | null | undefined): boolean {
  return indicator != null && indicator.trim() !== "";
}

/**
 * Resolve a single credit value when Banner omits `creditHours` but the
 * section is not genuinely variable-credit (no TO/OR indicator, no high bound).
 */
export function effectiveCreditHours(s: CreditFields): number | null {
  if (s.creditHours != null && Number.isFinite(s.creditHours)) {
    return s.creditHours;
  }
  if (
    !hasCreditIndicator(s.creditHourIndicator) &&
    s.creditHourHigh == null &&
    s.creditHourLow != null &&
    Number.isFinite(s.creditHourLow)
  ) {
    return s.creditHourLow;
  }
  return null;
}

/** Display string for a section's credits: fixed value, range, or em dash. */
export function formatCreditValue(s: CreditFields): string {
  const effective = effectiveCreditHours(s);
  if (effective != null) {
    return Number.isInteger(effective) ? String(effective) : effective.toFixed(1);
  }

  const low = s.creditHourLow;
  const high = s.creditHourHigh;
  if (low != null && high != null && low !== high) {
    return `${low}–${high}`;
  }
  if (low != null) return String(low);
  if (high != null) return String(high);
  return "—";
}

/** Sum credit hours for each planner item using anchor CRN or first calendar block. */
export function computePlannerCreditHours(
  effectivePlannerItems: readonly PlannerItemRow[],
  calendarBlocks: readonly CalendarBlock[],
  sections: readonly SectionWithCredits[],
): number {
  if (effectivePlannerItems.length === 0) return 0;

  const sectionByCrn = new Map<string, number | null>();
  for (const s of sections) {
    sectionByCrn.set(s.crn, effectiveCreditHours(s));
  }

  const anchorCrnByItemId = new Map<number, string>();
  for (const item of effectivePlannerItems) {
    if (item.anchorCrn) anchorCrnByItemId.set(item.id, item.anchorCrn);
  }

  const seenItems = new Set<number>();
  let sum = 0;
  for (const item of effectivePlannerItems) {
    if (seenItems.has(item.id)) continue;
    seenItems.add(item.id);

    const anchorCrn = anchorCrnByItemId.get(item.id);
    if (anchorCrn) {
      const ch = sectionByCrn.get(anchorCrn);
      if (typeof ch === "number" && Number.isFinite(ch)) sum += ch;
      continue;
    }

    const block = calendarBlocks.find((b) => b.plannerItemId === item.id);
    if (!block) continue;
    const ch = sectionByCrn.get(block.sectionCrn);
    if (typeof ch === "number" && Number.isFinite(ch)) sum += ch;
  }

  return sum;
}

export function formatCreditHours(total: number): string {
  const display = Number.isInteger(total) ? `${total}` : total.toFixed(1);
  return `${display} credit${total === 1 ? "" : "s"}`;
}
