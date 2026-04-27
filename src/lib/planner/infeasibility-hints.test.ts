import { describe, expect, it } from "vitest";
import { computeInfeasibilityHints } from "./infeasibility-hints";
import type { PlannerItemRow } from "./data";
import type { CourseSolvePack } from "./solve-schedules-core";
import { courseSolvePackCourseKey } from "./solve-schedules-core";
function minimalPack(
  subject: string,
  courseNumber: string,
  candidates: CourseSolvePack["candidates"],
  meetingsByCrn: CourseSolvePack["meetingsByCrn"],
): CourseSolvePack {
  const key = courseSolvePackCourseKey(subject, courseNumber);
  return {
    v: 1,
    courseKey: key,
    termCode: "T1",
    subject,
    courseNumber,
    candidates,
    bundleMembersById: {},
    meetingsByCrn,
    facultyByCrn: {},
    scheduleTypeByCrn: {},
    seatsByCrn: {},
  };
}

describe("computeInfeasibilityHints", () => {
  it("returns empty when a solution exists", () => {
    const items = [
      {
        id: 1,
        selectionKind: "unresolved",
        subject: "MATH",
        courseNumber: "1000",
      } as PlannerItemRow,
    ];
    const pack = minimalPack("MATH", "1000", [{ selectionKind: "single_crn", anchorCrn: "1", linkedBundleId: null, crns: ["1"] }], {
      "1": [{ dayIndex: 0, start: 9 * 60, end: 10 * 60 }],
    });
    const packs = { [courseSolvePackCourseKey("MATH", "1000")]: pack };
    const hints = computeInfeasibilityHints({
      items,
      packs,
      blackouts: { v: 1, items: [] },
      requireOpenSections: false,
    });
    expect(hints).toEqual([]);
  });

  it("suggests relaxing busy times when blackouts block an otherwise feasible pack", () => {
    const items = [
      {
        id: 1,
        selectionKind: "unresolved",
        subject: "MATH",
        courseNumber: "1000",
      } as PlannerItemRow,
    ];
    const pack = minimalPack("MATH", "1000", [{ selectionKind: "single_crn", anchorCrn: "1", linkedBundleId: null, crns: ["1"] }], {
      "1": [{ dayIndex: 0, start: 9 * 60, end: 10 * 60 }],
    });
    const packs = { [courseSolvePackCourseKey("MATH", "1000")]: pack };
    const hints = computeInfeasibilityHints({
      items,
      packs,
      blackouts: {
        v: 1,
        items: [{ id: "b1", dayIndex: 0, start: 9 * 60, end: 10 * 60 }],
      },
      requireOpenSections: false,
    });
    expect(
      hints.some((h) =>
        h.toLowerCase().includes("busy"),
      ),
    ).toBe(true);
  });

  it("mentions seats filter when requireOpenSections blocks solve", () => {
    const items = [
      {
        id: 1,
        selectionKind: "unresolved",
        subject: "MATH",
        courseNumber: "1000",
      } as PlannerItemRow,
    ];
    const pack = minimalPack(
      "MATH",
      "1000",
      [{ selectionKind: "single_crn", anchorCrn: "1", linkedBundleId: null, crns: ["1"] }],
      {
        "1": [{ dayIndex: 0, start: 9 * 60, end: 10 * 60 }],
      },
    );
    pack.seatsByCrn = {
      "1": { seatsAvailable: 0, openSection: false },
    };
    const packs = { [courseSolvePackCourseKey("MATH", "1000")]: pack };
    const hints = computeInfeasibilityHints({
      items,
      packs,
      blackouts: { v: 1, items: [] },
      requireOpenSections: true,
    });
    expect(
      hints.some((h) => h.toLowerCase().includes("exclude")),
    ).toBe(true);
  });
});
