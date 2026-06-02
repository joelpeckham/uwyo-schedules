import { describe, expect, it } from "vitest";
import { stripSectionSuffixFromCourseTitle } from "./strip-section-suffix-from-course-title";

describe("stripSectionSuffixFromCourseTitle", () => {
  it("strips - Sec N suffix", () => {
    expect(stripSectionSuffixFromCourseTitle("Gen Chemistry I - Sec 2")).toBe(
      "Gen Chemistry I",
    );
  });

  it("strips - Section N suffix", () => {
    expect(
      stripSectionSuffixFromCourseTitle("General Physics I - Section 3"),
    ).toBe("General Physics I");
  });

  it("strips Sec. abbreviation", () => {
    expect(stripSectionSuffixFromCourseTitle("Calculus I - Sec. 1")).toBe(
      "Calculus I",
    );
  });

  it("is case insensitive", () => {
    expect(stripSectionSuffixFromCourseTitle("Gen Chemistry I - sec 2")).toBe(
      "Gen Chemistry I",
    );
  });

  it("leaves titles without a section suffix unchanged", () => {
    expect(stripSectionSuffixFromCourseTitle("General Physics I")).toBe(
      "General Physics I",
    );
  });

  it("does not strip mid-title dashes", () => {
    expect(
      stripSectionSuffixFromCourseTitle("Laboratory - Repeat Lecture"),
    ).toBe("Laboratory - Repeat Lecture");
  });
});
