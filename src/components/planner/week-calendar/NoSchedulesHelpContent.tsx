"use client";

import type { PlannerBlackoutsDocV1 } from "@/lib/planner/blackouts";
import type { PlannerItemRow } from "@/lib/planner/data";
import type { InfeasibilityHint } from "@/lib/planner/infeasibility-hints";
import {
  ALL_STATIC_NO_SCHEDULE_HINT_KINDS,
  filterStaticNoScheduleHints,
  type StaticNoScheduleHintKind,
} from "@/lib/planner/no-schedules-help";
import { plannerHasAnyInstructorPrefs, hasInstructorPrefs, parseInstructorPrefs } from "@/lib/planner/instructor-prefs";
import { countPlannerSectionPins } from "@/lib/planner/section-pins";
import type { PlannerScheduleFilters } from "@/lib/planner/schedule-filters";
import { track } from "@/lib/analytics/track";
import { HintActionButton } from "./HintActionButton";
import { scrollToId, scrollToIdAndFocus } from "./interaction";

type Props = {
  hints: InfeasibilityHint[];
  requireOpenSections: boolean;
  busyCount: number;
  blackouts: PlannerBlackoutsDocV1;
  plannerItems: PlannerItemRow[];
  canUndo: boolean;
  undo: () => void;
  lastActionWasBusyAddOrUpdate: boolean;
  setRequireOpenSections: (v: boolean) => void;
  setExcludeTba: (v: boolean) => void;
  setExcludeOnlineAsync: (v: boolean) => void;
  recalculateSolutions: (
    filterOverrides?: Partial<PlannerScheduleFilters>,
  ) => Promise<void>;
  setBlackouts: (
    doc:
      | PlannerBlackoutsDocV1
      | ((prev: PlannerBlackoutsDocV1) => PlannerBlackoutsDocV1),
  ) => void;
  onEditBlackout: (blackoutId: string) => void;
  clearAllInstructorPrefs: () => void;
  clearAllSectionPins: () => void;
};

export function NoSchedulesHelpContent({
  hints,
  requireOpenSections,
  busyCount,
  blackouts,
  plannerItems,
  canUndo,
  undo,
  lastActionWasBusyAddOrUpdate,
  setRequireOpenSections,
  setExcludeTba,
  setExcludeOnlineAsync,
  recalculateSolutions,
  setBlackouts,
  onEditBlackout,
  clearAllInstructorPrefs,
  clearAllSectionPins,
}: Props) {
  const showUndoBusy = lastActionWasBusyAddOrUpdate && canUndo;
  const visibleSolver = hints.filter((h) => h.kind !== "generic");
  const visibleSolverKinds = new Set(visibleSolver.map((h) => h.kind));
  const pinCount = countPlannerSectionPins(plannerItems);
  const anyInstructorPrefs = plannerHasAnyInstructorPrefs(plannerItems);
  const staticCandidates = ALL_STATIC_NO_SCHEDULE_HINT_KINDS.filter((k) => {
    if (k === "edit_busy") return busyCount > 0;
    if (k === "relax_instructor") return anyInstructorPrefs;
    if (k === "relax_pins") return pinCount > 0;
    return true;
  });
  const staticKinds = filterStaticNoScheduleHints(
    visibleSolverKinds,
    staticCandidates,
  );
  const showDivider =
    visibleSolver.length > 0 && staticKinds.length > 0;

  const actions = {
    turnOffExcludeFull: () => {
      setRequireOpenSections(false);
      track("planner_exclude_full_toggled", { on: false });
      void recalculateSolutions({ requireOpenSections: false });
      scrollToIdAndFocus("planner-filters", "#exclude-full-toggle");
    },
    turnOnExcludeFull: () => {
      setRequireOpenSections(true);
      track("planner_exclude_full_toggled", { on: true });
      void recalculateSolutions({ requireOpenSections: true });
      scrollToIdAndFocus("planner-filters", "#exclude-full-toggle");
    },
    turnOffExcludeTba: () => {
      setExcludeTba(false);
      track("planner_exclude_tba_toggled", { on: false });
      void recalculateSolutions({ excludeTba: false });
      scrollToIdAndFocus("planner-filters", "#exclude-tba-toggle");
    },
    turnOffExcludeOnlineAsync: () => {
      setExcludeOnlineAsync(false);
      track("planner_exclude_online_async_toggled", { on: false });
      void recalculateSolutions({ excludeOnlineAsync: false });
      scrollToIdAndFocus("planner-filters", "#exclude-online-async-toggle");
    },
    undoBusy: () => undo(),
    clearAllBusy: () => {
      track("planner_blackouts_cleared", {
        count: blackouts.items.length,
      });
      setBlackouts({ v: 1, items: [] });
    },
    clearAllInstructorPrefs: () => {
      const courseCount = plannerItems.filter(
        (item) =>
          item.selectionKind === "unresolved" &&
          hasInstructorPrefs(parseInstructorPrefs(item.instructorPrefs)),
      ).length;
      if (courseCount === 0) return;
      track("planner_instructor_prefs_cleared", { courseCount });
      clearAllInstructorPrefs();
    },
    clearAllSectionPins: () => {
      if (pinCount === 0) return;
      track("planner_section_pins_cleared", { pinCount });
      clearAllSectionPins();
    },
    scrollToCourse: (plannerItemId: number) =>
      scrollToId(`planner-course-${plannerItemId}`),
    scrollToFilters: () => scrollToId("planner-filters"),
    onEditBlackout,
  };

  return (
    <div>
      <h3
        id="planner-no-schedules-heading"
        className="text-center font-medium text-foreground"
      >
        No schedule fits yet.
      </h3>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        Try one of these to open up the week:
      </p>
      {visibleSolver.length > 0 ? (
        <ul className="mx-auto mt-2 max-w-sm list-inside list-disc space-y-2 text-left text-sm text-foreground">
          {visibleSolver.map((h) => (
            <SolverHintRow
              key={`${h.kind}:${h.message}`}
              hint={h}
              busyCount={busyCount}
              showUndoBusy={showUndoBusy}
              plannerItems={plannerItems}
              actions={actions}
            />
          ))}
        </ul>
      ) : null}
      {showDivider ? (
        <div
          className="mx-auto mt-3 max-w-md border-t-2 border-foreground rounded-full"
          role="separator"
        />
      ) : null}
      {staticKinds.length > 0 ? (
        <ul
          className={
            showDivider
              ? "mx-auto mt-3 max-w-sm list-inside list-disc space-y-2 text-left text-sm text-foreground"
              : "mx-auto mt-2 max-w-sm list-inside list-disc space-y-2 text-left text-sm text-foreground"
          }
        >
          {staticKinds.map((kind) => (
            <StaticHintRow
              key={kind}
              kind={kind}
              requireOpenSections={requireOpenSections}
              busyCount={busyCount}
              showUndoBusy={showUndoBusy}
              pinCount={pinCount}
              actions={actions}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type HintActions = {
  turnOffExcludeFull: () => void;
  turnOnExcludeFull: () => void;
  turnOffExcludeTba: () => void;
  turnOffExcludeOnlineAsync: () => void;
  undoBusy: () => void;
  clearAllBusy: () => void;
  clearAllInstructorPrefs: () => void;
  clearAllSectionPins: () => void;
  scrollToCourse: (plannerItemId: number) => void;
  scrollToFilters: () => void;
  onEditBlackout: (blackoutId: string) => void;
};

type SolverRowProps = {
  hint: InfeasibilityHint;
  busyCount: number;
  showUndoBusy: boolean;
  plannerItems: PlannerItemRow[];
  actions: HintActions;
};

function SolverHintRow({
  hint,
  busyCount,
  showUndoBusy,
  plannerItems,
  actions,
}: SolverRowProps) {
  const courseLabel = hint.plannerItemId
    ? (() => {
        const item = plannerItems.find((i) => i.id === hint.plannerItemId);
        return item ? `${item.subject} ${item.courseNumber}` : null;
      })()
    : null;

  switch (hint.kind) {
    case "relax_busy":
      return (
        <li>
          {showUndoBusy ? (
            <>
              <HintActionButton onClick={actions.undoBusy}>
                Undo busy time
              </HintActionButton>
              {busyCount > 0 ? " · " : null}
            </>
          ) : null}
          {busyCount > 0 ? (
            <HintActionButton onClick={actions.clearAllBusy}>
              Clear all busy times
            </HintActionButton>
          ) : null}
          <span className="text-muted-foreground">
            {" "}
            to open up sections blocked by your calendar blocks.
          </span>
        </li>
      );
    case "relax_exclude_full":
      return (
        <li>
          <HintActionButton onClick={actions.turnOffExcludeFull}>
            Turn off “Exclude full”
          </HintActionButton>
          <span className="text-muted-foreground">
            {" "}
            to allow full sections, then turn it on again once you see a pattern
            that works.
          </span>
        </li>
      );
    case "relax_exclude_tba":
      return (
        <li>
          <HintActionButton onClick={actions.turnOffExcludeTba}>
            Turn off “Exclude TBA times”
          </HintActionButton>
          <span className="text-muted-foreground">
            {" "}
            to allow sections without a set meeting time.
          </span>
        </li>
      );
    case "relax_exclude_online_async":
      return (
        <li>
          <HintActionButton onClick={actions.turnOffExcludeOnlineAsync}>
            Turn off “Exclude online · async”
          </HintActionButton>
          <span className="text-muted-foreground">
            {" "}
            to allow asynchronous online sections.
          </span>
        </li>
      );
    case "course_busy_conflict":
      return (
        <li>
          {hint.plannerItemId && courseLabel ? (
            <>
                Go to {courseLabel}. {" "}
            </>
          ) : null}
          {hint.blackoutId ? (
            <>
              <HintActionButton
                onClick={() => actions.onEditBlackout(hint.blackoutId!)}
              >
                Edit busy time
              </HintActionButton>
              {" · "}
            </>
          ) : busyCount > 0 ? (
            <>
              <HintActionButton onClick={actions.clearAllBusy}>
                Clear all busy times
              </HintActionButton>
              {" · "}
            </>
          ) : null}
          <HintActionButton onClick={actions.scrollToFilters}>
            Relax filters
          </HintActionButton>
          <span className="text-muted-foreground">
            {" "}
            if every section pattern for this course hits your busy times.
          </span>
        </li>
      );
    default:
      return (
        <li>
          <span className="sr-only">{hint.message}</span>
          <span aria-hidden>{hint.message}</span>
        </li>
      );
  }
}

type StaticRowProps = {
  kind: StaticNoScheduleHintKind;
  requireOpenSections: boolean;
  busyCount: number;
  showUndoBusy: boolean;
  pinCount: number;
  actions: HintActions;
};

function StaticHintRow({
  kind,
  requireOpenSections,
  busyCount,
  showUndoBusy,
  pinCount,
  actions,
}: StaticRowProps) {
  switch (kind) {
    case "toggle_exclude_full":
      return requireOpenSections ? (
        <li>
          <HintActionButton onClick={actions.turnOffExcludeFull}>
            Turn off “Exclude full”
          </HintActionButton>
          <span className="text-muted-foreground">
            {" "}
            (then turn it on again if you need open seats only).
          </span>
        </li>
      ) : (
        <li>
          <HintActionButton onClick={actions.turnOnExcludeFull}>
            Try “Exclude full”
          </HintActionButton>
          <span className="text-muted-foreground">
            {" "}
            if you want only open seats.
          </span>
        </li>
      );
    case "edit_busy":
      return (
        <li>
          {showUndoBusy ? (
            <>
              <HintActionButton onClick={actions.undoBusy}>
                Undo busy time
              </HintActionButton>
              {" · "}
            </>
          ) : null}
          <HintActionButton onClick={actions.clearAllBusy}>
            Clear all busy times
          </HintActionButton>
          <span className="text-muted-foreground">
            {" "}
            ({busyCount} on your calendar)
          </span>
        </li>
      );
    case "relax_instructor":
      return (
        <li>
          <HintActionButton onClick={actions.clearAllInstructorPrefs}>
            Relax instructor choices
          </HintActionButton>
          <span className="text-muted-foreground">
            {" "}
            to allow any instructor for every course.
          </span>
        </li>
      );
    case "relax_pins":
      return (
        <li>
          <HintActionButton onClick={actions.clearAllSectionPins}>
            Clear all pins
          </HintActionButton>
          <span className="text-muted-foreground">
            {" "}
            ({pinCount} on your courses)
          </span>
        </li>
      );
    case "remove_course":
      return (
        <li>
          Remove a course if you added more than you need this term.
        </li>
      );
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
