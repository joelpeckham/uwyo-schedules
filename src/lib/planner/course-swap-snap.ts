import {
  CALENDAR_HOUR_COUNT,
  CALENDAR_START_HOUR,
} from "@/lib/planner/constants";
import type { CalendarBlock, SwapGhostMeeting } from "@/lib/planner/data";

function distPointToRect(
  px: number,
  py: number,
  r: { left: number; top: number; width: number; height: number },
): number {
  const cx = Math.max(r.left, Math.min(px, r.left + r.width));
  const cy = Math.max(r.top, Math.min(py, r.top + r.height));
  return Math.hypot(px - cx, py - cy);
}

export function ghostViewportRect(
  g: SwapGhostMeeting,
  dayStrip: HTMLDivElement,
  gridHeightPx: number,
  startMin: number,
  totalMin: number,
  visibleDayIndices: readonly number[],
): { left: number; top: number; width: number; height: number } | null {
  const colOffset = visibleDayIndices.indexOf(g.dayIndex);
  if (colOffset < 0) return null;
  const col = dayStrip.children[colOffset] as HTMLElement | undefined;
  if (!col) return null;
  const cr = col.getBoundingClientRect();
  const topPx = ((g.startMinutes - startMin) / totalMin) * gridHeightPx;
  const rawH = ((g.endMinutes - g.startMinutes) / totalMin) * gridHeightPx;
  const heightPx = Math.max(8, rawH);
  return {
    left: cr.left + 2,
    top: cr.top + topPx,
    width: Math.max(0, cr.width - 4),
    height: heightPx,
  };
}

/** True when the pointer is close enough to the source block to cancel a swap. */
export function swapSnapStayWins(
  dSource: number,
  bestD: number,
  snapMaxDistPx: number,
  hasGhostInSnapRange: boolean,
): boolean {
  const tiePx = 0.5;
  if (dSource > snapMaxDistPx) return false;
  if (
    !hasGhostInSnapRange ||
    dSource < bestD - tiePx ||
    Math.abs(dSource - bestD) <= tiePx
  ) {
    return true;
  }
  return false;
}

function clipBlockToCalendarWindow(block: {
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
}): SwapGhostMeeting | null {
  const windowStart = CALENDAR_START_HOUR * 60;
  const windowEnd = windowStart + CALENDAR_HOUR_COUNT * 60;
  const clipStart = Math.max(block.startMinutes, windowStart);
  const clipEnd = Math.min(block.endMinutes, windowEnd);
  if (clipEnd <= clipStart) return null;
  return {
    crn: "",
    meetingId: 0,
    dayIndex: block.dayIndex,
    startMinutes: clipStart,
    endMinutes: clipEnd,
  };
}

/**
 * Pick the nearest feasible swap ghost, or null when the pointer is at least
 * as close to the dragged block’s own slot as to any ghost (avoids snapping to
 * a sibling section that shares the same on-screen window).
 */
export function pickCourseSwapSnap(
  clientX: number,
  clientY: number,
  ghosts: SwapGhostMeeting[],
  sourceBlock: Pick<
    CalendarBlock,
    "dayIndex" | "startMinutes" | "endMinutes"
  >,
  dayStrip: HTMLDivElement,
  gridHeightPx: number,
  startMin: number,
  totalMin: number,
  visibleDayIndices: readonly number[],
  snapMaxDistPx: number,
): SwapGhostMeeting | null {
  let best: SwapGhostMeeting | null = null;
  let bestD = snapMaxDistPx + 1;
  for (const g of ghosts) {
    const r = ghostViewportRect(
      g,
      dayStrip,
      gridHeightPx,
      startMin,
      totalMin,
      visibleDayIndices,
    );
    if (!r || r.width <= 0) continue;
    const d = distPointToRect(clientX, clientY, r);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }

  const clipped = clipBlockToCalendarWindow(sourceBlock);
  let dSource = snapMaxDistPx + 1;
  if (clipped) {
    const sr = ghostViewportRect(
      clipped,
      dayStrip,
      gridHeightPx,
      startMin,
      totalMin,
      visibleDayIndices,
    );
    if (sr && sr.width > 0) {
      dSource = distPointToRect(clientX, clientY, sr);
    }
  }

  const hasGhostInSnapRange = best !== null && bestD <= snapMaxDistPx;
  if (
    swapSnapStayWins(dSource, bestD, snapMaxDistPx, hasGhostInSnapRange)
  ) {
    return null;
  }

  return bestD <= snapMaxDistPx ? best : null;
}
