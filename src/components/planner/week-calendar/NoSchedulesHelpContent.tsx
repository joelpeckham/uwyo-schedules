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
import { parseItemScheduleFilters } from "@/lib/planner/schedule-filters";
import { track } from "@/lib/analytics/track";
import type { CourseSettingsPanel } from "@/components/planner/CourseSettingsModal";
import { HintActionButton } from "./HintActionButton";
import { scrollToId } from "./interaction";

type Props = {
  hints: InfeasibilityHint[];
  busyCount: number;
  blackouts: PlannerBlackoutsDocV1;
  plannerItems: PlannerItemRow[];
  canUndo: boolean;
  undo: () => void;
  lastActionWasBusyAddOrUpdate: boolean;
  onOpenCourseSettings: (itemId: number, panel?: CourseSettingsPanel) => void;
  onRelaxFiltersForAllCourses: () => void;
  recalculateSolutions: () => Promise<void>;
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
  busyCount,
  blackouts,
  plannerItems,
  canUndo,
  undo,
  lastActionWasBusyAddOrUpdate,
  onOpenCourseSettings,
  onRelaxFiltersForAllCourses,
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

  const scrollToCourseAndOpen = (
    plannerItemId: number,
    panel: CourseSettingsPanel = "filters",
  ) => {
    scrollToId(`planner-course-${plannerItemId}`);
    onOpenCourseSettings(plannerItemId, panel);
  };

  const actions = {
    relaxExcludeFullForCourse: (plannerItemId: number) => {
      onOpenCourseSettings(plannerItemId, "filters");
      scrollToId(`planner-course-${plannerItemId}`);
    },
    relaxExcludeTbaForCourse: (plannerItemId: number) => {
      onOpenCourseSettings(plannerItemId, "filters");
      scrollToId(`planner-course-${plannerItemId}`);
    },
    relaxExcludeOnlineAsyncForCourse: (plannerItemId: number) => {
      onOpenCourseSettings(plannerItemId, "filters");
      scrollToId(`planner-course-${plannerItemId}`);
    },
    relaxFiltersForAll: () => {
      onRelaxFiltersForAllCourses();
      void recalculateSolutions();
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
      scrollToCourseAndOpen(plannerItemId, "filters"),
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
              plannerItems={plannerItems}
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
  relaxExcludeFullForCourse: (plannerItemId: number) => void;
  relaxExcludeTbaForCourse: (plannerItemId: number) => void;
  relaxExcludeOnlineAsyncForCourse: (plannerItemId: number) => void;
  relaxFiltersForAll: () => void;
  undoBusy: () => void;
  clearAllBusy: () => void;
  clearAllInstructorPrefs: () => void;
  clearAllSectionPins: () => void;
  scrollToCourse: (plannerItemId: number) => void;
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
          {hint.plannerItemId ? (
            <HintActionButton
              onClick={() =>
                actions.relaxExcludeFullForCourse(hint.plannerItemId!)
              }
            >
              Open filters for {courseLabel ?? "this course"}
            </HintActionButton>
          ) : (
            <HintActionButton onClick={actions.relaxFiltersForAll}>
              Relax filters on all courses
            </HintActionButton>
          )}
          <span className="text-muted-foreground">
            {" "}
            to allow full sections.
          </span>
        </li>
      );
    case "relax_exclude_tba":
      return (
        <li>
          {hint.plannerItemId ? (
            <HintActionButton
              onClick={() =>
                actions.relaxExcludeTbaForCourse(hint.plannerItemId!)
              }
            >
              Open filters for {courseLabel ?? "this course"}
            </HintActionButton>
          ) : (
            <HintActionButton onClick={actions.relaxFiltersForAll}>
              Relax filters on all courses
            </HintActionButton>
          )}
          <span className="text-muted-foreground">
            {" "}
            to allow sections without a set meeting time.
          </span>
        </li>
      );
    case "relax_exclude_online_async":
      return (
        <li>
          {hint.plannerItemId ? (
            <HintActionButton
              onClick={() =>
                actions.relaxExcludeOnlineAsyncForCourse(hint.plannerItemId!)
              }
            >
              Open filters for {courseLabel ?? "this course"}
            </HintActionButton>
          ) : (
            <HintActionButton onClick={actions.relaxFiltersForAll}>
              Relax filters on all courses
            </HintActionButton>
          )}
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
              <HintActionButton
                onClick={() => actions.scrollToCourse(hint.plannerItemId!)}
              >
                Open {courseLabel} settings
              </HintActionButton>
              {" · "}
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
          <span className="text-muted-foreground">
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
  plannerItems: PlannerItemRow[];
  busyCount: number;
  showUndoBusy: boolean;
  pinCount: number;
  actions: HintActions;
};

function StaticHintRow({
  kind,
  plannerItems,
  busyCount,
  showUndoBusy,
  pinCount,
  actions,
}: StaticRowProps) {
  const anyExcludeFull = plannerItems.some(
    (item) =>
      item.selectionKind === "unresolved" &&
      parseItemScheduleFilters(item.scheduleFilters).requireOpenSections,
  );

  switch (kind) {
    case "toggle_exclude_full":
      return anyExcludeFull ? (
        <li>
          <HintActionButton onClick={actions.relaxFiltersForAll}>
            Relax “Exclude full” on all courses
          </HintActionButton>
          <span className="text-muted-foreground">
            {" "}
            to allow full sections.
          </span>
        </li>
      ) : (
        <li>
          Turn on “Exclude full” in a course&rsquo;s settings if you want only
          open seats.
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
