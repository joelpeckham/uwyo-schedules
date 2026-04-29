/** Pinch damping + touch heuristics for week grid zoom/pan */

/** Scrollable week grid viewport; keep loading placeholders in sync to reduce CLS. */
export const PLANNER_WEEK_VIEWPORT_HEIGHT = "min(72vh, 40rem)";

export const MAX_HOUR_ROW_PX = 140;
export const TWO_FINGER_PINCH_ZOOM_MIN_RATIO = 0.12;
export const TWO_FINGER_PAN_STABLE_MAX_RATIO = 0.2;
export const TWO_FINGER_PAN_CENTROID_MIN_PX = 5;
export const PINCH_ZOOM_RESPONSE = 0.42;

export const DRAG_THRESHOLD_PX = 6;
export const SNAP_MAX_DIST_PX = 72;
