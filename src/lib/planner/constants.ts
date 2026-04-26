export const PLANNER_SESSION_COOKIE = "uwyo_planner_sid";

/** UUID v4 pattern for cookie validation */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export { DEFAULT_COURSE_DISPLAY_COLOR as DEFAULT_DISPLAY_COLOR } from "./course-colors";

/** First hour row (4:00–4:59 a.m.). */
export const CALENDAR_START_HOUR = 4;
/** Last hour row (11:00 p.m.–11:59 p.m.). */
export const CALENDAR_END_HOUR = 23;

/** Inclusive hour rows from start through end (20 for 4–23). */
export const CALENDAR_HOUR_COUNT =
  CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1;
