/** Pinch damping + touch heuristics for week grid zoom/pan */

import { CALENDAR_HOUR_COUNT } from "@/lib/planner/constants";

/** Scrollable week grid viewport; keep loading placeholders in sync to reduce CLS. */
export const PLANNER_WEEK_VIEWPORT_HEIGHT = "min(72vh, 40rem)";

/** Matches `40rem` at a 16px root — upper cap in `min(72vh, 40rem)`. */
const PLANNER_WEEK_VIEWPORT_MAX_PX = 640;

export const MIN_HOUR_ROW_PX = 44;
export const MAX_HOUR_ROW_PX = 140;

/** Default week grid columns (Mon–Fri); weekends added when content needs them. */
export const PLANNER_WEEKDAY_DAY_INDICES = [0, 1, 2, 3, 4] as const;

/** Min width of the weekday grid in rem (hour axis 3.5 + 5 × 4.5rem). */
export const PLANNER_WEEKDAY_GRID_MIN_WIDTH_REM = 26;

/**
 * Estimates the scroll viewport height in px (same as CSS `min(72vh, 40rem)`).
 * SSR uses the 40rem cap so server and first client paint agree.
 */
function estimatePlannerWeekViewportHeightPx(): number {
  if (typeof window === "undefined") {
    return PLANNER_WEEK_VIEWPORT_MAX_PX;
  }
  return Math.min(window.innerHeight * 0.72, PLANNER_WEEK_VIEWPORT_MAX_PX);
}

/** Default hour-row height before/without ResizeObserver (shared by skeleton + live grid). */
export function initialPlannerHourRowPx(
  hourCount: number = CALENDAR_HOUR_COUNT,
): number {
  const viewportH = estimatePlannerWeekViewportHeightPx();
  const floor = viewportH / hourCount;
  return Math.min(MAX_HOUR_ROW_PX, Math.max(MIN_HOUR_ROW_PX, floor));
}

export const TWO_FINGER_PINCH_ZOOM_MIN_RATIO = 0.12;
export const TWO_FINGER_PAN_STABLE_MAX_RATIO = 0.2;
export const TWO_FINGER_PAN_CENTROID_MIN_PX = 5;
export const PINCH_ZOOM_RESPONSE = 0.42;

export const DRAG_THRESHOLD_PX = 6;
export const SNAP_MAX_DIST_PX = 72;
