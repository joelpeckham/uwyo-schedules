export const PLANNER_SESSION_COOKIE = "uwyo_planner_sid";

/** UUID v4 pattern for cookie validation */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Preset stripe colors (earth / sage tones, WCAG-friendly on cream) */
export const COLOR_PRESETS = [
  { id: "rust", hex: "#a65d3a" },
  { id: "sage", hex: "#4a6b55" },
  { id: "slate", hex: "#3d4f5f" },
  { id: "violet", hex: "#5c4a6b" },
  { id: "pine", hex: "#2d4a3d" },
  { id: "ochre", hex: "#8b6914" },
] as const;

export const DEFAULT_DISPLAY_COLOR = COLOR_PRESETS[0].hex;

/** First hour row (4:00–4:59 a.m.). */
export const CALENDAR_START_HOUR = 4;
/** Last hour row (11:00 p.m.–11:59 p.m.). */
export const CALENDAR_END_HOUR = 23;

/** Inclusive hour rows from start through end (20 for 4–23). */
export const CALENDAR_HOUR_COUNT =
  CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1;
