/**
 * Planner course stripe colors: bright, hue-separated swatches in a 2D grid
 * (rows = lightness bands, columns = hue steps).
 */

function hslToHex(h: number, s: number, l: number): string {
  const s1 = s / 100;
  const l1 = l / 100;
  const c = (1 - Math.abs(2 * l1 - 1)) * s1;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l1 - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

const HUE_STEP = 30;
const HUES: number[] = [];
for (let h = 0; h < 360; h += HUE_STEP) {
  HUES.push(h);
}

/** Rows: higher lightness (brighter) at top; columns: hue across the wheel. */
const LIGHTNESS_ROWS = [56, 48, 40] as const;
const SATURATION = 82;

const grid: string[][] = LIGHTNESS_ROWS.map((lightness) =>
  HUES.map((hue) => hslToHex(hue, SATURATION, lightness)),
);

export const COURSE_COLOR_GRID = grid as readonly (readonly string[])[];

const seen = new Set<string>();
const flat: string[] = [];
for (const row of COURSE_COLOR_GRID) {
  for (const hex of row) {
    const key = hex.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      flat.push(hex);
    }
  }
}

export const COURSE_COLOR_PALETTE = flat as readonly string[];

const COURSE_COLOR_PALETTE_LOWER = new Set(
  COURSE_COLOR_PALETTE.map((c) => c.toLowerCase()),
);

const DEFAULT_COURSE_DISPLAY_COLOR = COURSE_COLOR_PALETTE[0]!;

/** True if `hex` is exactly one of the planner swatches (#RRGGBB). */
export function isPlannerCoursePaletteColor(hex: string): boolean {
  return COURSE_COLOR_PALETTE_LOWER.has(hex.trim().toLowerCase());
}

/**
 * Picks a random unused swatch. If every swatch is already used, returns a
 * deterministic fallback from the palette so inserts never fail.
 */
export function pickUnusedCourseColor(
  usedLowercaseHexes: ReadonlySet<string>,
): string {
  const order = [...COURSE_COLOR_PALETTE];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = order[i]!;
    order[i] = order[j]!;
    order[j] = t;
  }
  for (const c of order) {
    if (!usedLowercaseHexes.has(c.toLowerCase())) {
      return c;
    }
  }
  return (
    COURSE_COLOR_PALETTE[usedLowercaseHexes.size % COURSE_COLOR_PALETTE.length] ??
    DEFAULT_COURSE_DISPLAY_COLOR
  );
}
