import { describe, expect, it } from "vitest";
import {
  COURSE_COLOR_PALETTE,
  isPlannerCoursePaletteColor,
  pickUnusedCourseColor,
} from "./course-colors";

describe("isPlannerCoursePaletteColor", () => {
  it("accepts palette swatches regardless of case", () => {
    const sample = COURSE_COLOR_PALETTE[0]!;
    expect(isPlannerCoursePaletteColor(sample)).toBe(true);
    expect(isPlannerCoursePaletteColor(sample.toLowerCase())).toBe(true);
    expect(isPlannerCoursePaletteColor(` ${sample} `)).toBe(true);
  });

  it("rejects colors outside the planner grid", () => {
    expect(isPlannerCoursePaletteColor("#000000")).toBe(false);
    expect(isPlannerCoursePaletteColor("#FFFFFF")).toBe(false);
  });
});

describe("pickUnusedCourseColor", () => {
  it("returns a palette color when nothing is used", () => {
    const c = pickUnusedCourseColor(new Set());
    expect(COURSE_COLOR_PALETTE).toContain(c);
  });

  it("returns the only free color when exactly one swatch remains", () => {
    const keep = COURSE_COLOR_PALETTE[5]!;
    const used = new Set(
      COURSE_COLOR_PALETTE.filter((h) => h !== keep).map((h) => h.toLowerCase()),
    );
    expect(pickUnusedCourseColor(used)).toBe(keep);
  });

  it("falls back when every palette color is used", () => {
    const used = new Set(COURSE_COLOR_PALETTE.map((h) => h.toLowerCase()));
    const c = pickUnusedCourseColor(used);
    expect(COURSE_COLOR_PALETTE).toContain(c);
  });
});
