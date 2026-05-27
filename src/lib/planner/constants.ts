/** Guardrail against unbounded list growth / abuse per session+term. */
export const MAX_PLANNER_COURSES_PER_TERM = 40;

/** First hour row (4:00–4:59 a.m.). */
export const CALENDAR_START_HOUR = 4;
/** Last hour row (11:00 p.m.–11:59 p.m.). */
export const CALENDAR_END_HOUR = 23;

/** Inclusive hour rows from start through end (20 for 4–23). */
export const CALENDAR_HOUR_COUNT =
  CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1;
