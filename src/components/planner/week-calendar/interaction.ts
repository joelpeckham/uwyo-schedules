import type { SwapGhostMeeting } from "@/lib/planner/data";
import {
  ghostViewportRect,
} from "@/lib/planner/course-swap-snap";
import {
  DRAG_THRESHOLD_PX,
  MAX_HOUR_ROW_PX,
  PINCH_ZOOM_RESPONSE,
  SNAP_MAX_DIST_PX,
} from "./constants";

export { DRAG_THRESHOLD_PX, MAX_HOUR_ROW_PX, SNAP_MAX_DIST_PX };

export function touchDistance(t: TouchList): number {
  const a = t[0];
  const b = t[1];
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

export function touchCentroidY(t: TouchList): number {
  return (t[0]!.clientY + t[1]!.clientY) / 2;
}

export function touchCentroidX(t: TouchList): number {
  return (t[0]!.clientX + t[1]!.clientX) / 2;
}

export function dampedPinchRowRatio(
  startRowPx: number,
  rawRatio: number,
  clamp: (n: number) => number,
): number {
  const t = 1 + (rawRatio - 1) * PINCH_ZOOM_RESPONSE;
  return clamp(startRowPx * t);
}

export function formatQuarterHourLabel(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ap = h24 >= 12 ? "p.m." : "a.m.";
  const hr = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${hr}${mm} ${ap}`;
}

export function clientYToMinutes(
  clientY: number,
  columnEl: HTMLElement,
  gridHeightPx: number,
  startMin: number,
  totalMin: number,
): number {
  const rect = columnEl.getBoundingClientRect();
  const y = clientY - rect.top;
  const frac = Math.max(0, Math.min(1, y / gridHeightPx));
  return startMin + frac * totalMin;
}

export function scrollToId(id: string): void {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export function buildFloatStyle(
  strip: HTMLDivElement | null,
  sess: {
    snapped: SwapGhostMeeting | null;
    ghosts: SwapGhostMeeting[];
    clientX: number;
    clientY: number;
    grabDx: number;
    grabDy: number;
  },
  gridHeightPx: number,
  startMin: number,
  totalMin: number,
  visibleDayIndices: readonly number[],
): { left: number; top: number; width: number; height: number } {
  if (strip && sess.snapped && sess.ghosts.length > 0) {
    const r = ghostViewportRect(
      sess.snapped,
      strip,
      gridHeightPx,
      startMin,
      totalMin,
      visibleDayIndices,
    );
    if (r && r.width > 0) return r;
  }
  return {
    left: sess.clientX - sess.grabDx,
    top: sess.clientY - sess.grabDy,
    width: 120,
    height: 48,
  };
}
