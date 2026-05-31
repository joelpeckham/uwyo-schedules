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

/** Bottom-row swatch indices in contrast-friendly round-robin order. */
const DEFAULT_COURSE_COLOR_CYCLE_BOTTOM_INDICES = [1, 3, 7, 2, 6, 0, 10] as const;

const topRow = COURSE_COLOR_GRID[0]!;
const bottomRow = COURSE_COLOR_GRID[2]!;
const pickerColumnCount = bottomRow.length;

/** Top-row column adjacent to the paired bottom swatch (+1, or −1 at last column). */
function hueShiftedTopColumn(bottomColumnIndex: number): number {
  if (bottomColumnIndex < pickerColumnCount - 1) {
    return bottomColumnIndex + 1;
  }
  return bottomColumnIndex - 1;
}

const defaultCourseColorCycleBottom =
  DEFAULT_COURSE_COLOR_CYCLE_BOTTOM_INDICES.map((i) => bottomRow[i]!);

const defaultCourseColorCycleTop =
  DEFAULT_COURSE_COLOR_CYCLE_BOTTOM_INDICES.map(
    (i) => topRow[hueShiftedTopColumn(i)]!,
  );

/** Default colors assigned when adding courses (bottom row, then hue-shifted top row). */
export const DEFAULT_COURSE_COLOR_CYCLE = [
  ...defaultCourseColorCycleBottom,
  ...defaultCourseColorCycleTop,
] as readonly string[];

const COURSE_COLOR_PALETTE_LOWER = new Set(
  COURSE_COLOR_PALETTE.map((c) => c.toLowerCase()),
);

/** True if `hex` is exactly one of the planner swatches (#RRGGBB). */
export function isPlannerCoursePaletteColor(hex: string): boolean {
  return COURSE_COLOR_PALETTE_LOWER.has(hex.trim().toLowerCase());
}

/**
 * Picks the next default swatch from {@link DEFAULT_COURSE_COLOR_CYCLE}.
 * Starts at `existingCourseCount % cycle.length`; skips colors already used
 * by walking forward in the cycle. If every cycle color is used, returns the
 * starting swatch so inserts never fail.
 */
export function pickUnusedCourseColor(
  usedLowercaseHexes: ReadonlySet<string>,
  existingCourseCount: number,
): string {
  const cycle = DEFAULT_COURSE_COLOR_CYCLE;
  const start = existingCourseCount % cycle.length;
  for (let i = 0; i < cycle.length; i++) {
    const c = cycle[(start + i) % cycle.length]!;
    if (!usedLowercaseHexes.has(c.toLowerCase())) {
      return c;
    }
  }
  return cycle[start]!;
}
