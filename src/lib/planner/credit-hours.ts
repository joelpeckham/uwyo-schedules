import type { CalendarBlock, PlannerItemRow } from "./data";

type SectionWithCredits = { crn: string; creditHours: number | null };

/** Sum credit hours for each planner item using anchor CRN or first calendar block. */
export function computePlannerCreditHours(
  effectivePlannerItems: readonly PlannerItemRow[],
  calendarBlocks: readonly CalendarBlock[],
  sections: readonly SectionWithCredits[],
): number {
  if (effectivePlannerItems.length === 0) return 0;

  const sectionByCrn = new Map<string, number | null>();
  for (const s of sections) sectionByCrn.set(s.crn, s.creditHours);

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
