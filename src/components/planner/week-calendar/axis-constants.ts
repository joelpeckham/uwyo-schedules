import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
} from "@/lib/planner/constants";

/** Inclusive 4 a.m. through 11 p.m. axis used by the interactive planner. */
export const CALENDAR_HOUR_AXIS: readonly number[] = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 },
  (_, i) => CALENDAR_START_HOUR + i,
);

/**
 * Compact axis used by static previews (landing PlannerPreview, OG image).
 * Nine rows so the last row's "4 p.m." label sits at the top of the row.
 */
export const LANDING_PREVIEW_HOUR_AXIS: readonly number[] = [
  8, 9, 10, 11, 12, 13, 14, 15, 16,
];

export const DAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
