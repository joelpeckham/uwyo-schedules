import type { CalendarBlock, SwapGhostMeeting } from "@/lib/planner/data";
import type { PlannerBlackoutItemV1 } from "@/lib/planner/blackouts";

/**
 * Pre-group items by `dayIndex` so per-day render is O(n) over items
 * instead of filtering the full list for every day column.
 */
export function groupBlocksByDay(
  blocks: readonly CalendarBlock[],
): Map<number, CalendarBlock[]> {
  const map = new Map<number, CalendarBlock[]>();
  for (const b of blocks) {
    const list = map.get(b.dayIndex);
    if (list) list.push(b);
    else map.set(b.dayIndex, [b]);
  }
  return map;
}

export function groupBlackoutsByDay(
  items: readonly PlannerBlackoutItemV1[],
): Map<number, PlannerBlackoutItemV1[]> {
  const map = new Map<number, PlannerBlackoutItemV1[]>();
  for (const bo of items) {
    const list = map.get(bo.dayIndex);
    if (list) list.push(bo);
    else map.set(bo.dayIndex, [bo]);
  }
  return map;
}

export function groupSwapGhostsByDay(
  ghosts: readonly SwapGhostMeeting[] | null | undefined,
): Map<number, SwapGhostMeeting[]> {
  const map = new Map<number, SwapGhostMeeting[]>();
  if (!ghosts) return map;
  for (const g of ghosts) {
    const list = map.get(g.dayIndex);
    if (list) list.push(g);
    else map.set(g.dayIndex, [g]);
  }
  return map;
}
