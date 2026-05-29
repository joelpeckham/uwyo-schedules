import { describe, expect, it } from "vitest";
import type { PlannerItemRow } from "./data";
import {
  courseSolvePackCourseKey,
  eligibleForStandaloneSingleCrn,
  hasAnyOverlap,
  intervalsOverlap,
  meetingRowToIntervals,
  scheduleSolutionStillValidForItems,
  solveSchedulesFromPacks,
  type CourseSolvePack,
  type ScheduleSolution,
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
    selectionKind: "unresolved",
    anchorCrn: null,
    linkedBundleId: null,
    instructorPrefs: { v: 1, primary: [] },
    sectionPins: { v: 1, byType: {} },
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
    deliveryModeByCrn: partial.deliveryModeByCrn ?? {},
  };
}

const relaxedFilters = {
  requireOpenSections: false,
  excludeTba: false,
  excludeOnlineAsync: false,
} as const;

describe("solveSchedulesFromPacks", () => {
  it("returns empty when no planner items", () => {
    const r = solveSchedulesFromPacks([], {}, relaxedFilters);
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
      ...relaxedFilters,
    });
    expect(r.solutions).toHaveLength(1);
    expect(r.solutions[0]!.selections[1]!.anchorCrn).toBe("A1");
    expect(r.solutions[0]!.selections[2]!.anchorCrn).toBe("B1");
  });

  it("orders multiple solutions deterministically by anchor CRNs", () => {
    const packs: Record<string, CourseSolvePack> = {
      [courseSolvePackCourseKey("CS", "1000")]: basePack("CS", "1000", {
        candidates: [
          {
            selectionKind: "single_crn",
            anchorCrn: "B1",
            linkedBundleId: null,
            crns: ["B1"],
          },
          {
            selectionKind: "single_crn",
            anchorCrn: "A1",
            linkedBundleId: null,
            crns: ["A1"],
          },
        ],
        meetingsByCrn: {
          A1: [{ dayIndex: 0, start: 600, end: 660 }],
          B1: [{ dayIndex: 1, start: 600, end: 660 }],
        },
        facultyByCrn: {},
        scheduleTypeByCrn: {},
        seatsByCrn: {
          A1: { seatsAvailable: 1, openSection: true },
          B1: { seatsAvailable: 1, openSection: true },
        },
      }),
    };
    const items = [itemStub({ id: 1, subject: "CS", courseNumber: "1000" })];
    const r = solveSchedulesFromPacks(items, packs, {
      ...relaxedFilters,
      maxSolutions: 2,
    });
    expect(r.solutions).toHaveLength(2);
    const keys = r.solutions.map((sol) =>
      Object.values(sol.selections)
        .map((s) => s.anchorCrn)
        .sort()
        .join(","),
    );
    expect(keys).toEqual(["A1", "B1"]);
    expect(r.solutions.every((sol) => sol.score === 0)).toBe(true);
  });

  it("blackout overlapping the only meeting yields no solutions", () => {
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
    };
    const items = [itemStub({ id: 1, subject: "CS", courseNumber: "1000" })];
    const r = solveSchedulesFromPacks(items, packs, {
      ...relaxedFilters,
      blackoutIntervals: [{ dayIndex: 0, start: 600, end: 660 }],
    });
    expect(r.solutions).toHaveLength(0);
  });

  it("blackout on another day still allows schedule", () => {
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
      ...relaxedFilters,
      blackoutIntervals: [{ dayIndex: 1, start: 600, end: 720 }],
    });
    expect(r.solutions).toHaveLength(1);
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
      ...relaxedFilters,
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
      excludeTba: false,
      excludeOnlineAsync: false,
    });
    expect(open.solutions).toHaveLength(0);
    const any = solveSchedulesFromPacks(items, packs, {
      ...relaxedFilters,
    });
    expect(any.solutions).toHaveLength(1);
  });

  it("hard-filters single_crn candidates by primary instructor pref", () => {
    const packs: Record<string, CourseSolvePack> = {
      [courseSolvePackCourseKey("CS", "1000")]: basePack("CS", "1000", {
        candidates: [
          {
            selectionKind: "single_crn",
            anchorCrn: "A1",
            linkedBundleId: null,
            crns: ["A1"],
          },
          {
            selectionKind: "single_crn",
            anchorCrn: "A2",
            linkedBundleId: null,
            crns: ["A2"],
          },
        ],
        meetingsByCrn: {
          A1: [{ dayIndex: 0, start: 600, end: 660 }],
          A2: [{ dayIndex: 0, start: 600, end: 660 }],
        },
        facultyByCrn: {
          A1: [{ displayName: "Alice Smith", primaryIndicator: true }],
          A2: [{ displayName: "Bob Jones", primaryIndicator: true }],
        },
        scheduleTypeByCrn: {
          A1: "Lecture",
          A2: "Lecture",
        },
        seatsByCrn: {
          A1: { seatsAvailable: 1, openSection: true },
          A2: { seatsAvailable: 1, openSection: true },
        },
      }),
    };
    const items = [
      itemStub({
        id: 1,
        subject: "CS",
        courseNumber: "1000",
        instructorPrefs: { v: 1, primary: ["Alice"] },
      }),
    ];
    const r = solveSchedulesFromPacks(items, packs, {
      ...relaxedFilters,
    });
    expect(r.solutions).toHaveLength(1);
    expect(r.solutions[0]!.selections[1]!.anchorCrn).toBe("A1");
  });

  it("hard-filters linked_bundle candidates by lab instructor pref", () => {
    const packs: Record<string, CourseSolvePack> = {
      [courseSolvePackCourseKey("CHEM", "1000")]: basePack("CHEM", "1000", {
        bundleMembersById: {
          "10": ["L1", "LAB1"],
          "11": ["L2", "LAB2"],
        },
        candidates: [
          {
            selectionKind: "linked_bundle",
            anchorCrn: "L1",
            linkedBundleId: 10,
            crns: ["L1", "LAB1"],
          },
          {
            selectionKind: "linked_bundle",
            anchorCrn: "L2",
            linkedBundleId: 11,
            crns: ["L2", "LAB2"],
          },
        ],
        meetingsByCrn: {
          L1: [{ dayIndex: 1, start: 600, end: 660 }],
          LAB1: [{ dayIndex: 1, start: 700, end: 760 }],
          L2: [{ dayIndex: 1, start: 600, end: 660 }],
          LAB2: [{ dayIndex: 1, start: 700, end: 760 }],
        },
        facultyByCrn: {
          L1: [{ displayName: "Dr Lee", primaryIndicator: true }],
          LAB1: [{ displayName: "Sam Smith", primaryIndicator: true }],
          L2: [{ displayName: "Dr Lee", primaryIndicator: true }],
          LAB2: [{ displayName: "Pat Jones", primaryIndicator: true }],
        },
        scheduleTypeByCrn: {
          L1: "Lecture",
          LAB1: "Laboratory",
          L2: "Lecture",
          LAB2: "Laboratory",
        },
        seatsByCrn: {
          L1: { seatsAvailable: 1, openSection: true },
          LAB1: { seatsAvailable: 1, openSection: true },
          L2: { seatsAvailable: 1, openSection: true },
          LAB2: { seatsAvailable: 1, openSection: true },
        },
      }),
    };
    const items = [
      itemStub({
        id: 2,
        subject: "CHEM",
        courseNumber: "1000",
        instructorPrefs: {
          v: 1,
          primary: [],
          byScheduleType: { laboratory: ["Jones"] },
        },
      }),
    ];
    const r = solveSchedulesFromPacks(items, packs, {
      ...relaxedFilters,
    });
    expect(r.solutions).toHaveLength(1);
    expect(r.solutions[0]!.selections[2]!.anchorCrn).toBe("L2");
  });

  it("excludes TBA sections when excludeTba is on", () => {
    const packs: Record<string, CourseSolvePack> = {
      [courseSolvePackCourseKey("CS", "1000")]: basePack("CS", "1000", {
        candidates: [
          {
            selectionKind: "single_crn",
            anchorCrn: "TBA1",
            linkedBundleId: null,
            crns: ["TBA1"],
          },
          {
            selectionKind: "single_crn",
            anchorCrn: "A1",
            linkedBundleId: null,
            crns: ["A1"],
          },
        ],
        meetingsByCrn: {
          TBA1: [],
          A1: [{ dayIndex: 0, start: 600, end: 660 }],
        },
        facultyByCrn: {},
        scheduleTypeByCrn: {},
        seatsByCrn: {
          TBA1: { seatsAvailable: 5, openSection: true },
          A1: { seatsAvailable: 5, openSection: true },
        },
        deliveryModeByCrn: {
          TBA1: "tba",
          A1: "in_person",
        },
      }),
    };
    const items = [itemStub({ id: 1, subject: "CS", courseNumber: "1000" })];
    const filtered = solveSchedulesFromPacks(items, packs, {
      requireOpenSections: false,
      excludeTba: true,
      excludeOnlineAsync: false,
    });
    expect(filtered.solutions).toHaveLength(1);
    expect(filtered.solutions[0]!.selections[1]!.anchorCrn).toBe("A1");

    const allowed = solveSchedulesFromPacks(items, packs, {
      requireOpenSections: false,
      excludeTba: false,
      excludeOnlineAsync: false,
    });
    expect(allowed.solutions).toHaveLength(1);
    expect(allowed.solutions[0]!.selections[1]!.anchorCrn).toBe("TBA1");
  });

  it("excludes online_async sections when excludeOnlineAsync is on", () => {
    const packs: Record<string, CourseSolvePack> = {
      [courseSolvePackCourseKey("CS", "1000")]: basePack("CS", "1000", {
        candidates: [
          {
            selectionKind: "single_crn",
            anchorCrn: "O1",
            linkedBundleId: null,
            crns: ["O1"],
          },
          {
            selectionKind: "single_crn",
            anchorCrn: "A1",
            linkedBundleId: null,
            crns: ["A1"],
          },
        ],
        meetingsByCrn: {
          O1: [],
          A1: [{ dayIndex: 0, start: 600, end: 660 }],
        },
        facultyByCrn: {},
        scheduleTypeByCrn: {},
        seatsByCrn: {
          O1: { seatsAvailable: 5, openSection: true },
          A1: { seatsAvailable: 5, openSection: true },
        },
        deliveryModeByCrn: {
          O1: "online_async",
          A1: "in_person",
        },
      }),
    };
    const items = [itemStub({ id: 1, subject: "CS", courseNumber: "1000" })];
    const filtered = solveSchedulesFromPacks(items, packs, {
      requireOpenSections: false,
      excludeTba: false,
      excludeOnlineAsync: true,
    });
    expect(filtered.solutions).toHaveLength(1);
    expect(filtered.solutions[0]!.selections[1]!.anchorCrn).toBe("A1");
  });
});

describe("scheduleSolutionStillValidForItems", () => {
  it("returns true for the current solve result", () => {
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
    const sol = solveSchedulesFromPacks(items, packs, {
      ...relaxedFilters,
    }).solutions[0]!;
    expect(
      scheduleSolutionStillValidForItems(items, packs, sol, {
        ...relaxedFilters,
      }),
    ).toBe(true);
  });

  it("returns false when a pin excludes the solution’s section", () => {
    const packs: Record<string, CourseSolvePack> = {
      [courseSolvePackCourseKey("CS", "1000")]: basePack("CS", "1000", {
        candidates: [
          {
            selectionKind: "single_crn",
            anchorCrn: "A1",
            linkedBundleId: null,
            crns: ["A1"],
          },
          {
            selectionKind: "single_crn",
            anchorCrn: "A2",
            linkedBundleId: null,
            crns: ["A2"],
          },
        ],
        meetingsByCrn: {
          A1: [{ dayIndex: 0, start: 600, end: 660 }],
          A2: [{ dayIndex: 1, start: 600, end: 660 }],
        },
        facultyByCrn: {},
        scheduleTypeByCrn: {
          A1: "Lecture",
          A2: "Lecture",
        },
        seatsByCrn: {
          A1: { seatsAvailable: 3, openSection: true },
          A2: { seatsAvailable: 3, openSection: true },
        },
      }),
    };
    const solution: ScheduleSolution = {
      score: 0,
      selections: {
        1: {
          selectionKind: "single_crn",
          anchorCrn: "A2",
          linkedBundleId: null,
        },
      },
    };
    const items = [
      itemStub({
        id: 1,
        subject: "CS",
        courseNumber: "1000",
        sectionPins: { v: 1, byType: { lecture: "A1" } },
      }),
    ];
    expect(
      scheduleSolutionStillValidForItems(items, packs, solution, {
        ...relaxedFilters,
      }),
    ).toBe(false);
  });

  it("proves infeasibility quickly when many courses share one time slot", () => {
    const sharedSlot = { dayIndex: 0, start: 600, end: 660 };
    const courseCount = 8;
    const sectionsPerCourse = 12;
    const packs: Record<string, CourseSolvePack> = {};
    const items: PlannerItemRow[] = [];

    for (let c = 0; c < courseCount; c++) {
      const subject = `C${c}`;
      const courseNumber = "1000";
      const candidates = [];
      const meetingsByCrn: CourseSolvePack["meetingsByCrn"] = {};
      const seatsByCrn: CourseSolvePack["seatsByCrn"] = {};
      for (let s = 0; s < sectionsPerCourse; s++) {
        const crn = `${subject}${s}`;
        candidates.push({
          selectionKind: "single_crn" as const,
          anchorCrn: crn,
          linkedBundleId: null,
          crns: [crn],
        });
        meetingsByCrn[crn] = [sharedSlot];
        seatsByCrn[crn] = { seatsAvailable: 5, openSection: true };
      }
      packs[courseSolvePackCourseKey(subject, courseNumber)] = basePack(
        subject,
        courseNumber,
        {
          candidates,
          meetingsByCrn,
          facultyByCrn: {},
          scheduleTypeByCrn: {},
          seatsByCrn,
        },
      );
      items.push(
        itemStub({ id: c + 1, subject, courseNumber }),
      );
    }

    const started = performance.now();
    const r = solveSchedulesFromPacks(items, packs, {
      ...relaxedFilters,
      timeoutMs: 1000,
    });
    const elapsed = performance.now() - started;

    expect(r.solutions).toHaveLength(0);
    expect(r.timedOut).toBe(false);
    expect(elapsed).toBeLessThan(500);
  });

  it("finds feasible schedule when one section per course uses staggered times", () => {
    const packs: Record<string, CourseSolvePack> = {};
    const items: PlannerItemRow[] = [];
    for (let c = 0; c < 6; c++) {
      const subject = `S${c}`;
      const courseNumber = "1";
      const crn = `${subject}A`;
      packs[courseSolvePackCourseKey(subject, courseNumber)] = basePack(
        subject,
        courseNumber,
        {
          candidates: [
            {
              selectionKind: "single_crn",
              anchorCrn: crn,
              linkedBundleId: null,
              crns: [crn],
            },
          ],
          meetingsByCrn: {
            [crn]: [{ dayIndex: 0, start: 600 + c * 70, end: 660 + c * 70 }],
          },
          facultyByCrn: {},
          scheduleTypeByCrn: {},
          seatsByCrn: {
            [crn]: { seatsAvailable: 1, openSection: true },
          },
        },
      );
      items.push(itemStub({ id: c + 1, subject, courseNumber }));
    }
    const r = solveSchedulesFromPacks(items, packs, relaxedFilters);
    expect(r.solutions).toHaveLength(1);
    expect(r.timedOut).toBe(false);
  });
});
