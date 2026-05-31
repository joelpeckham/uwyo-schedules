import { describe, expect, it } from "vitest";
import {
  COURSE_COLOR_PALETTE,
  DEFAULT_COURSE_COLOR_CYCLE,
  isPlannerCoursePaletteColor,
  pickUnusedCourseColor,
} from "./course-colors";

describe("DEFAULT_COURSE_COLOR_CYCLE", () => {
  it("matches the contrast-friendly bottom row then hue-shifted top row", () => {
    expect([...DEFAULT_COURSE_COLOR_CYCLE]).toEqual([
      "#BA6612",
      "#66BA12",
      "#1266BA",
      "#BABA12",
      "#12BABA",
      "#BA1212",
      "#BA12BA",
      "#EBEB33",
      "#33EB33",
      "#3333EB",
      "#8FEB33",
      "#338FEB",
      "#EB8F33",
      "#EB338F",
    ]);
  });
});

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
  it("returns the first cycle color when nothing is used", () => {
    expect(pickUnusedCourseColor(new Set(), 0)).toBe("#BA6612");
  });

  it("returns the second cycle color after one course", () => {
    expect(
      pickUnusedCourseColor(new Set(["#ba6612"]), 1),
    ).toBe("#66BA12");
  });

  it("advances in the cycle when the start color is already used", () => {
    const used = new Set(["#ba6612"]);
    expect(pickUnusedCourseColor(used, 0)).toBe("#66BA12");
  });

  it("returns the starting swatch when every cycle color is used", () => {
    const used = new Set(
      DEFAULT_COURSE_COLOR_CYCLE.map((h) => h.toLowerCase()),
    );
    expect(pickUnusedCourseColor(used, 3)).toBe("#BABA12");
  });

  it("uses top-row colors after the first seven bottom-row slots", () => {
    const used = new Set(
      DEFAULT_COURSE_COLOR_CYCLE.slice(0, 7).map((h) => h.toLowerCase()),
    );
    expect(pickUnusedCourseColor(used, 7)).toBe("#EBEB33");
  });
});
