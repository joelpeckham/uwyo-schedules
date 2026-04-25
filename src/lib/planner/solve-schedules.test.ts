import { describe, expect, it } from "vitest";
import type { PlannerItemRow } from "./data";
import {
  courseSolvePackCourseKey,
  eligibleForStandaloneSingleCrn,
  hasAnyOverlap,
  intervalsOverlap,
  meetingRowToIntervals,
  solveSchedulesFromPacks,
  type CourseSolvePack,
} from "./solve-schedules-core";

describe("intervalsOverlap", () => {
  it("detects overlap same day", () => {
    expect(
      intervalsOverlap(
        { dayIndex: 1, start: 600, end: 660 },
        { dayIndex: 1, start: 630, end: 690 },
      ),
    ).toBe(true);
  });

  it("no overlap different days", () => {
    expect(
      intervalsOverlap(
        { dayIndex: 1, start: 600, end: 660 },
        { dayIndex: 2, start: 600, end: 660 },
      ),
    ).toBe(false);
  });

  it("no overlap adjacent", () => {
    expect(
      intervalsOverlap(
        { dayIndex: 0, start: 600, end: 660 },
        { dayIndex: 0, start: 660, end: 720 },
      ),
    ).toBe(false);
  });
});

describe("hasAnyOverlap", () => {
  it("empty false", () => {
    expect(hasAnyOverlap([])).toBe(false);
  });

  it("single false", () => {
    expect(hasAnyOverlap([{ dayIndex: 0, start: 1, end: 2 }])).toBe(false);
  });

  it("finds pair", () => {
    expect(
      hasAnyOverlap([
        { dayIndex: 0, start: 100, end: 200 },
        { dayIndex: 0, start: 150, end: 250 },
      ]),
    ).toBe(true);
  });
});

describe("eligibleForStandaloneSingleCrn", () => {
  it("rejects CRNs that only appear as non-anchor linked bundle members", () => {
    const nonAnchorMembers = new Set(["10648", "10649"]);
    expect(eligibleForStandaloneSingleCrn("10648", nonAnchorMembers)).toBe(
      false,
    );
    expect(eligibleForStandaloneSingleCrn("10131", nonAnchorMembers)).toBe(
      true,
    );
  });
});

describe("meetingRowToIntervals", () => {
  it("expands monday", () => {
    const iv = meetingRowToIntervals({
      beginTime: "1000",
      endTime: "1050",
      monday: true,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    });
    expect(iv).toEqual([{ dayIndex: 0, start: 600, end: 650 }]);
  });

  it("invalid times empty", () => {
    expect(
      meetingRowToIntervals({
        beginTime: null,
        endTime: "1050",
        monday: true,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false,
      }),
    ).toEqual([]);
  });
});

function itemStub(
  overrides: Partial<PlannerItemRow> &
    Pick<PlannerItemRow, "id" | "subject" | "courseNumber">,
): PlannerItemRow {
  return {
    sessionId: "00000000-0000-0000-0000-000000000001",
    termCode: "202401",
    displayColor: "#000",
    sortOrder: 0,
    selectionKind: "unresolved",
    anchorCrn: null,
    linkedBundleId: null,
    instructorPrefs: { v: 1, primary: [] },
    ...overrides,
  } as PlannerItemRow;
}

function basePack(
  subject: string,
  courseNumber: string,
  partial: Partial<Omit<CourseSolvePack, "v" | "courseKey">> &
    Pick<
      CourseSolvePack,
      | "candidates"
      | "meetingsByCrn"
      | "facultyByCrn"
      | "scheduleTypeByCrn"
      | "seatsByCrn"
    >,
): CourseSolvePack {
  const courseKey = courseSolvePackCourseKey(subject, courseNumber);
  return {
    v: 1,
    courseKey,
    termCode: "202401",
    subject,
    courseNumber,
    bundleMembersById: partial.bundleMembersById ?? {},
    candidates: partial.candidates,
    meetingsByCrn: partial.meetingsByCrn,
    facultyByCrn: partial.facultyByCrn,
    scheduleTypeByCrn: partial.scheduleTypeByCrn,
    seatsByCrn: partial.seatsByCrn,
  };
}

describe("solveSchedulesFromPacks", () => {
  it("returns empty when no planner items", () => {
    const r = solveSchedulesFromPacks([], {}, { requireOpenSections: false });
    expect(r.solutions).toEqual([]);
    expect(r.capped).toBe(false);
    expect(r.timedOut).toBe(false);
  });

  it("finds one non-overlapping combination across two courses", () => {
    const packs: Record<string, CourseSolvePack> = {
      [courseSolvePackCourseKey("CS", "1000")]: basePack("CS", "1000", {
        candidates: [
          {
            selectionKind: "single_crn",
            anchorCrn: "A1",
            linkedBundleId: null,
            crns: ["A1"],
          },
        ],
        meetingsByCrn: {
          A1: [{ dayIndex: 0, start: 600, end: 660 }],
        },
        facultyByCrn: {},
        scheduleTypeByCrn: {},
        seatsByCrn: {
          A1: { seatsAvailable: 3, openSection: true },
        },
      }),
      [courseSolvePackCourseKey("MATH", "2000")]: basePack("MATH", "2000", {
        candidates: [
          {
            selectionKind: "single_crn",
            anchorCrn: "B1",
            linkedBundleId: null,
            crns: ["B1"],
          },
        ],
        meetingsByCrn: {
          B1: [{ dayIndex: 0, start: 700, end: 760 }],
        },
        facultyByCrn: {},
        scheduleTypeByCrn: {},
        seatsByCrn: {
          B1: { seatsAvailable: 2, openSection: true },
        },
      }),
    };
    const items = [
      itemStub({ id: 1, subject: "CS", courseNumber: "1000" }),
      itemStub({ id: 2, subject: "MATH", courseNumber: "2000" }),
    ];
    const r = solveSchedulesFromPacks(items, packs, {
      requireOpenSections: false,
    });
    expect(r.solutions).toHaveLength(1);
    expect(r.solutions[0]!.selections[1]!.anchorCrn).toBe("A1");
    expect(r.solutions[0]!.selections[2]!.anchorCrn).toBe("B1");
  });

  it("returns no solutions when only overlapping sections exist", () => {
    const packs: Record<string, CourseSolvePack> = {
      [courseSolvePackCourseKey("CS", "1000")]: basePack("CS", "1000", {
        candidates: [
          {
            selectionKind: "single_crn",
            anchorCrn: "A1",
            linkedBundleId: null,
            crns: ["A1"],
          },
        ],
        meetingsByCrn: {
          A1: [{ dayIndex: 0, start: 600, end: 720 }],
        },
        facultyByCrn: {},
        scheduleTypeByCrn: {},
        seatsByCrn: {
          A1: { seatsAvailable: 1, openSection: true },
        },
      }),
      [courseSolvePackCourseKey("MATH", "2000")]: basePack("MATH", "2000", {
        candidates: [
          {
            selectionKind: "single_crn",
            anchorCrn: "B1",
            linkedBundleId: null,
            crns: ["B1"],
          },
        ],
        meetingsByCrn: {
          B1: [{ dayIndex: 0, start: 660, end: 780 }],
        },
        facultyByCrn: {},
        scheduleTypeByCrn: {},
        seatsByCrn: {
          B1: { seatsAvailable: 1, openSection: true },
        },
      }),
    };
    const items = [
      itemStub({ id: 10, subject: "CS", courseNumber: "1000" }),
      itemStub({ id: 11, subject: "MATH", courseNumber: "2000" }),
    ];
    const r = solveSchedulesFromPacks(items, packs, {
      requireOpenSections: false,
    });
    expect(r.solutions).toHaveLength(0);
  });

  it("respects requireOpenSections using seats in pack", () => {
    const packs: Record<string, CourseSolvePack> = {
      [courseSolvePackCourseKey("X", "1")]: basePack("X", "1", {
        candidates: [
          {
            selectionKind: "single_crn",
            anchorCrn: "X1",
            linkedBundleId: null,
            crns: ["X1"],
          },
        ],
        meetingsByCrn: { X1: [{ dayIndex: 2, start: 100, end: 200 }] },
        facultyByCrn: {},
        scheduleTypeByCrn: {},
        seatsByCrn: {
          X1: { seatsAvailable: 0, openSection: true },
        },
      }),
    };
    const items = [itemStub({ id: 3, subject: "X", courseNumber: "1" })];
    const open = solveSchedulesFromPacks(items, packs, {
      requireOpenSections: true,
    });
    expect(open.solutions).toHaveLength(0);
    const any = solveSchedulesFromPacks(items, packs, {
      requireOpenSections: false,
    });
    expect(any.solutions).toHaveLength(1);
  });
});
