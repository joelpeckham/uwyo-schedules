import type { InfeasibilityHintKind } from "./infeasibility-hints";

export type StaticNoScheduleHintKind =
  | "toggle_exclude_full"
  | "edit_busy"
  | "relax_instructor"
  | "relax_pins"
  | "remove_course";

export const ALL_STATIC_NO_SCHEDULE_HINT_KINDS: readonly StaticNoScheduleHintKind[] =
  [
    "toggle_exclude_full",
    "edit_busy",
    "relax_instructor",
    "relax_pins",
    "remove_course",
  ] as const;

const STATIC_SUPPRESSED_BY_SOLVER: Record<
  StaticNoScheduleHintKind,
  readonly InfeasibilityHintKind[]
> = {
  toggle_exclude_full: ["relax_exclude_full"],
  edit_busy: ["relax_busy", "course_busy_conflict"],
  relax_instructor: [],
  relax_pins: [],
  remove_course: ["course_busy_conflict"],
};

/** Static overlay rows to show given visible (non-generic) solver hint kinds. */
export function filterStaticNoScheduleHints(
  visibleSolverKinds: ReadonlySet<InfeasibilityHintKind>,
  candidates: readonly StaticNoScheduleHintKind[],
): StaticNoScheduleHintKind[] {
  return candidates.filter((staticKind) => {
    const suppressors = STATIC_SUPPRESSED_BY_SOLVER[staticKind];
    return !suppressors.some((k) => visibleSolverKinds.has(k));
  });
}
