import { describe, expect, it } from "vitest";
import { computeInfeasibilityHints } from "./infeasibility-hints";
import type { PlannerItemRow } from "./data";
import type { CourseSolvePack } from "./solve-schedules-core";
import { courseSolvePackCourseKey } from "./solve-schedules-core";
import {
  defaultItemScheduleFilters,
  serializeItemScheduleFilters,
} from "./schedule-filters";

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

function itemRow(
  partial: Pick<PlannerItemRow, "id" | "subject" | "courseNumber"> &
    Partial<PlannerItemRow>,
): PlannerItemRow {
  return {
    sessionId: "",
    termCode: "T1",
    displayColor: "#000",
    selectionKind: "unresolved",
    anchorCrn: null,
    linkedBundleId: null,
    instructorPrefs: { v: 1, primary: [] },
    sectionPins: { v: 1, byType: {} },
    scheduleFilters: serializeItemScheduleFilters({
      v: 1,
      requireOpenSections: false,
      excludeTba: false,
      excludeOnlineAsync: false,
    }),
    ...partial,
  } as PlannerItemRow;
}

describe("computeInfeasibilityHints", () => {
  it("returns empty when a solution exists", () => {
    const items = [
      itemRow({ id: 1, subject: "MATH", courseNumber: "1000" }),
    ];
    const pack = minimalPack("MATH", "1000", [{ selectionKind: "single_crn", anchorCrn: "1", linkedBundleId: null, crns: ["1"] }], {
      "1": [{ dayIndex: 0, start: 9 * 60, end: 10 * 60 }],
    });
    const packs = { [courseSolvePackCourseKey("MATH", "1000")]: pack };
    const hints = computeInfeasibilityHints({
      items,
      packs,
      blackouts: { v: 1, items: [] },
    });
    expect(hints).toEqual([]);
  });

  it("suggests relaxing busy times when blackouts block an otherwise feasible pack", () => {
    const items = [
      itemRow({ id: 1, subject: "MATH", courseNumber: "1000" }),
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
    });
    expect(hints.some((h) => h.kind === "relax_busy")).toBe(true);
  });

  it("mentions seats filter when requireOpenSections blocks solve", () => {
    const items = [
      itemRow({
        id: 1,
        subject: "MATH",
        courseNumber: "1000",
        scheduleFilters: serializeItemScheduleFilters(
          defaultItemScheduleFilters(),
        ),
      }),
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
    });
    expect(hints.some((h) => h.kind === "relax_exclude_full")).toBe(true);
    expect(hints.find((h) => h.kind === "relax_exclude_full")?.plannerItemId).toBe(
      1,
    );
  });

  it("mentions TBA filter when excludeTba blocks solve", () => {
    const items = [
      itemRow({
        id: 1,
        subject: "MATH",
        courseNumber: "1000",
        scheduleFilters: serializeItemScheduleFilters({
          v: 1,
          requireOpenSections: false,
          excludeTba: true,
          excludeOnlineAsync: false,
        }),
      }),
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
    });
    expect(hints.some((h) => h.kind === "relax_exclude_tba")).toBe(true);
  });

  it("mentions online async filter when excludeOnlineAsync blocks solve", () => {
    const items = [
      itemRow({
        id: 1,
        subject: "MATH",
        courseNumber: "1000",
        scheduleFilters: serializeItemScheduleFilters({
          v: 1,
          requireOpenSections: false,
          excludeTba: false,
          excludeOnlineAsync: true,
        }),
      }),
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
    });
    expect(hints.some((h) => h.kind === "relax_exclude_online_async")).toBe(
      true,
    );
  });

  it("returns generic fallback when no relaxed diagnostic matches", () => {
    const items = [
      itemRow({ id: 1, subject: "MATH", courseNumber: "1000" }),
      itemRow({ id: 2, subject: "CHEM", courseNumber: "1000" }),
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
