import type { CalendarBlock } from "@/lib/planner/data";

type PreviewBlockLayout = {
  block: CalendarBlock;
  topPx: number;
  heightPx: number;
};

type PreviewMeetingRect = {
  topPx: number;
  heightPx: number;
};

type OgDragGhostSlot = {
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
  snapped: boolean;
};

/** Static drag-in-progress scene for the OG image (ENGL 1010 Tue → Wed snap). */
export const LANDING_PREVIEW_OG_DRAG_SCENARIO = {
  sourceBlockKey: "engl-tue",
  ghosts: [
    {
      dayIndex: 0,
      startMinutes: 11 * 60,
      endMinutes: 12 * 60 + 15,
      snapped: false,
    },
    {
      dayIndex: 2,
      startMinutes: 11 * 60,
      endMinutes: 12 * 60 + 15,
      snapped: true,
    },
    {
      dayIndex: 4,
      startMinutes: 11 * 60,
      endMinutes: 12 * 60 + 15,
      snapped: false,
    },
  ],
  floatOffsetPx: { dx: 70, dy: 4 },
  cursorOffsetPx: { dx: 36, dy: 12 },
} as const satisfies {
  sourceBlockKey: string;
  ghosts: readonly OgDragGhostSlot[];
  floatOffsetPx: { dx: number; dy: number };
  cursorOffsetPx: { dx: number; dy: number };
};

/** Position one meeting rectangle on a fixed hour-axis grid. */
export function layoutMeetingRectForHourAxis(
  startMinutes: number,
  endMinutes: number,
  hourAxis: readonly number[],
  rowPx: number,
): PreviewMeetingRect {
  const startMin = (hourAxis[0] ?? 0) * 60;
  const totalMin = hourAxis.length * 60;
  const gridHeightPx = hourAxis.length * rowPx;
  const topPx = ((startMinutes - startMin) / totalMin) * gridHeightPx;
  const rawH = ((endMinutes - startMinutes) / totalMin) * gridHeightPx;
  const heightPx = Math.max(8, rawH);
  return { topPx, heightPx };
}

/** Position landing preview blocks on a fixed hour-axis grid (OG image + tests). */
export function layoutPreviewBlocksForHourAxis(
  blocks: readonly CalendarBlock[],
  hourAxis: readonly number[],
  rowPx: number,
): Map<number, PreviewBlockLayout[]> {
  const byDay = new Map<number, PreviewBlockLayout[]>();

  for (const block of blocks) {
    const { topPx, heightPx } = layoutMeetingRectForHourAxis(
      block.startMinutes,
      block.endMinutes,
      hourAxis,
      rowPx,
    );
    const list = byDay.get(block.dayIndex) ?? [];
    list.push({ block, topPx, heightPx });
    byDay.set(block.dayIndex, list);
  }

  return byDay;
}

/** Group OG drag ghost slots by day index. */
export function groupOgDragGhostsByDay(
  ghosts: readonly OgDragGhostSlot[],
): Map<number, OgDragGhostSlot[]> {
  const byDay = new Map<number, OgDragGhostSlot[]>();
  for (const ghost of ghosts) {
    const list = byDay.get(ghost.dayIndex) ?? [];
    list.push(ghost);
    byDay.set(ghost.dayIndex, list);
  }
  return byDay;
}
