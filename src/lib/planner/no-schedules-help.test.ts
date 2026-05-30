import { describe, expect, it } from "vitest";
import type { InfeasibilityHintKind } from "./infeasibility-hints";
import {
  ALL_STATIC_NO_SCHEDULE_HINT_KINDS,
  filterStaticNoScheduleHints,
  type StaticNoScheduleHintKind,
} from "./no-schedules-help";

function kinds(...ks: InfeasibilityHintKind[]): ReadonlySet<InfeasibilityHintKind> {
  return new Set(ks);
}

function filterAll(
  visibleSolverKinds: ReadonlySet<InfeasibilityHintKind>,
): StaticNoScheduleHintKind[] {
  return filterStaticNoScheduleHints(
    visibleSolverKinds,
    ALL_STATIC_NO_SCHEDULE_HINT_KINDS,
  );
}

describe("filterStaticNoScheduleHints", () => {
  it("returns all static kinds when no solver kinds suppress them", () => {
    expect(filterAll(kinds())).toEqual([
      "toggle_exclude_full",
      "edit_busy",
      "relax_instructor",
      "relax_pins",
      "remove_course",
    ]);
  });

  it("drops toggle_exclude_full when relax_exclude_full is visible", () => {
    expect(filterAll(kinds("relax_exclude_full"))).toEqual([
      "edit_busy",
      "relax_instructor",
      "relax_pins",
      "remove_course",
    ]);
  });

  it("drops edit_busy when relax_busy is visible", () => {
    expect(filterAll(kinds("relax_busy"))).toEqual([
      "toggle_exclude_full",
      "relax_instructor",
      "relax_pins",
      "remove_course",
    ]);
  });

  it("drops edit_busy and remove_course when course_busy_conflict is visible", () => {
    expect(filterAll(kinds("course_busy_conflict"))).toEqual([
      "toggle_exclude_full",
      "relax_instructor",
      "relax_pins",
    ]);
  });

  it("keeps all static kinds when only generic would be in the solver set", () => {
    expect(filterAll(kinds("generic"))).toEqual([
      "toggle_exclude_full",
      "edit_busy",
      "relax_instructor",
      "relax_pins",
      "remove_course",
    ]);
  });

  it("drops multiple static rows when several solver kinds are visible", () => {
    expect(
      filterAll(kinds("relax_exclude_full", "course_busy_conflict")),
    ).toEqual(["relax_instructor", "relax_pins"]);
  });
});
