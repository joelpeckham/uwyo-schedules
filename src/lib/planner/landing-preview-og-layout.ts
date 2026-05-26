import type { CalendarBlock } from "@/lib/planner/data";

type PreviewBlockLayout = {
  block: CalendarBlock;
  topPx: number;
  heightPx: number;
};

/** Position landing preview blocks on a fixed hour-axis grid (OG image + tests). */
export function layoutPreviewBlocksForHourAxis(
  blocks: readonly CalendarBlock[],
  hourAxis: readonly number[],
  rowPx: number,
): Map<number, PreviewBlockLayout[]> {
  const startMin = (hourAxis[0] ?? 0) * 60;
  const totalMin = hourAxis.length * 60;
  const gridHeightPx = hourAxis.length * rowPx;
  const byDay = new Map<number, PreviewBlockLayout[]>();

  for (const block of blocks) {
    const topPx =
      ((block.startMinutes - startMin) / totalMin) * gridHeightPx;
    const rawH =
      ((block.endMinutes - block.startMinutes) / totalMin) * gridHeightPx;
    const heightPx = Math.max(8, rawH);
    const list = byDay.get(block.dayIndex) ?? [];
    list.push({ block, topPx, heightPx });
    byDay.set(block.dayIndex, list);
  }

  return byDay;
}
