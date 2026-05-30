import { describe, expect, it } from "vitest";
import {
  defaultInstructorPrefs,
  hasInstructorPrefs,
  plannerHasAnyInstructorPrefs,
} from "./instructor-prefs";

describe("hasInstructorPrefs", () => {
  it("returns false for empty defaults", () => {
    expect(hasInstructorPrefs(defaultInstructorPrefs())).toBe(false);
  });

  it("returns true when primary is set", () => {
    expect(
      hasInstructorPrefs({ v: 1, primary: ["Smith"], byScheduleType: undefined }),
    ).toBe(true);
  });

  it("returns true when linked schedule type is set", () => {
    expect(
      hasInstructorPrefs({
        v: 1,
        primary: [],
        byScheduleType: { lab: ["Jones"] },
      }),
    ).toBe(true);
  });
});

describe("plannerHasAnyInstructorPrefs", () => {
  it("ignores locked items and empty prefs", () => {
    expect(
      plannerHasAnyInstructorPrefs([
        {
          selectionKind: "anchor",
          instructorPrefs: { v: 1, primary: ["Smith"] },
        },
        { selectionKind: "unresolved", instructorPrefs: defaultInstructorPrefs() },
      ]),
    ).toBe(false);
  });

  it("returns true when an unresolved item has prefs", () => {
    expect(
      plannerHasAnyInstructorPrefs([
        { selectionKind: "unresolved", instructorPrefs: defaultInstructorPrefs() },
        {
          selectionKind: "unresolved",
          instructorPrefs: { v: 1, primary: ["Smith"] },
        },
      ]),
    ).toBe(true);
  });
});
