import type { CalendarBlock } from "@/lib/planner/data";

/** Logical slot identity for shared-layout animation across solve changes. */
export function magicMoveSlotKey(
  plannerItemId: number,
  sectionScheduleTypeKey: string,
  slotIndex: number,
): string {
  return `${plannerItemId}:${sectionScheduleTypeKey}:${slotIndex}`;
}

function compareBlocksForSlot(a: CalendarBlock, b: CalendarBlock): number {
  if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  return a.endMinutes - b.endMinutes;
}

/**
 * Assign stable magic-move ids per planner course + schedule-type group.
 * Blocks sorted by (dayIndex, startMinutes, endMinutes) receive slotIndex 0..n-1.
 */
export function buildMagicMoveIdMap(
  blocks: readonly CalendarBlock[],
): Map<string, string> {
  const byGroup = new Map<string, CalendarBlock[]>();

  for (const block of blocks) {
    const groupKey = `${block.plannerItemId}:${block.sectionScheduleTypeKey}`;
    const list = byGroup.get(groupKey);
    if (list) list.push(block);
    else byGroup.set(groupKey, [block]);
  }

  const out = new Map<string, string>();

  for (const [groupKey, groupBlocks] of byGroup) {
    const sorted = [...groupBlocks].sort(compareBlocksForSlot);
    const [plannerItemIdStr, sectionScheduleTypeKey] = groupKey.split(":");
    const plannerItemId = Number(plannerItemIdStr);

    sorted.forEach((block, slotIndex) => {
      out.set(
        block.key,
        magicMoveSlotKey(plannerItemId, sectionScheduleTypeKey, slotIndex),
      );
    });
  }

  return out;
}
