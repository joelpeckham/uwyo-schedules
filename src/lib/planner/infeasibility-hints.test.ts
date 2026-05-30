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
    deliveryModeByCrn: {},
  };
}

const relaxedFilters = {
  requireOpenSections: false,
  excludeTba: false,
  excludeOnlineAsync: false,
} as const;

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
      ...relaxedFilters,
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
      ...relaxedFilters,
    });
    expect(hints.some((h) => h.kind === "relax_busy")).toBe(true);
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
      excludeTba: false,
      excludeOnlineAsync: false,
    });
    expect(hints.some((h) => h.kind === "relax_exclude_full")).toBe(true);
  });

  it("mentions TBA filter when excludeTba blocks solve", () => {
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
      { "1": [{ dayIndex: 0, start: 9 * 60, end: 10 * 60 }] },
    );
    pack.deliveryModeByCrn = { "1": "tba" };
    const packs = { [courseSolvePackCourseKey("MATH", "1000")]: pack };
    const hints = computeInfeasibilityHints({
      items,
      packs,
      blackouts: { v: 1, items: [] },
      requireOpenSections: false,
      excludeTba: true,
      excludeOnlineAsync: false,
    });
    expect(hints.some((h) => h.kind === "relax_exclude_tba")).toBe(true);
  });

  it("mentions online async filter when excludeOnlineAsync blocks solve", () => {
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
      { "1": [{ dayIndex: 0, start: 9 * 60, end: 10 * 60 }] },
    );
    pack.deliveryModeByCrn = { "1": "online_async" };
    const packs = { [courseSolvePackCourseKey("MATH", "1000")]: pack };
    const hints = computeInfeasibilityHints({
      items,
      packs,
      blackouts: { v: 1, items: [] },
      requireOpenSections: false,
      excludeTba: false,
      excludeOnlineAsync: true,
    });
    expect(hints.some((h) => h.kind === "relax_exclude_online_async")).toBe(
      true,
    );
  });

  it("returns generic fallback when no relaxed diagnostic matches", () => {
    const items = [
      {
        id: 1,
        selectionKind: "unresolved",
        subject: "MATH",
        courseNumber: "1000",
      } as PlannerItemRow,
      {
        id: 2,
        selectionKind: "unresolved",
        subject: "CHEM",
        courseNumber: "1000",
      } as PlannerItemRow,
    ];
    const mathPack = minimalPack(
      "MATH",
      "1000",
      [{ selectionKind: "single_crn", anchorCrn: "1", linkedBundleId: null, crns: ["1"] }],
      { "1": [{ dayIndex: 0, start: 9 * 60, end: 10 * 60 }] },
    );
    const chemPack = minimalPack(
      "CHEM",
      "1000",
      [{ selectionKind: "single_crn", anchorCrn: "2", linkedBundleId: null, crns: ["2"] }],
      { "2": [{ dayIndex: 0, start: 9 * 60, end: 10 * 60 }] },
    );
    const packs = {
      [courseSolvePackCourseKey("MATH", "1000")]: mathPack,
      [courseSolvePackCourseKey("CHEM", "1000")]: chemPack,
    };
    const hints = computeInfeasibilityHints({
      items,
      packs,
      blackouts: { v: 1, items: [] },
      ...relaxedFilters,
      baseAlreadyInfeasible: true,
    });
    expect(hints).toEqual([
      {
        kind: "generic",
        message:
          "No combination fits yet — relax instructor picks (choose “Any”), adjust busy times, or remove one course.",
      },
    ]);
  });
});
