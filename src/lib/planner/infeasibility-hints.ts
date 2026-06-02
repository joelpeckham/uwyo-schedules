import { blackoutsDocToTimeIntervals, type PlannerBlackoutsDocV1 } from "./blackouts";
import type { PlannerCatalogJson } from "./client/catalog-types";
import type { PlannerItemRow } from "./data";
import { scheduleFiltersFromItem } from "./schedule-filters";
import {
  courseSolvePackCourseKey,
  intervalsOverlap,
  meetingRowToIntervals,
  patchItemsScheduleFilters,
  solveSchedulesFromPacks,
  type CourseSolvePack,
  type TimeInterval,
} from "./solve-schedules-core";

export type InfeasibilityHintKind =
  | "relax_busy"
  | "relax_exclude_full"
  | "relax_exclude_tba"
  | "relax_exclude_online_async"
  | "course_busy_conflict"
  | "generic";

export type InfeasibilityHint = {
  kind: InfeasibilityHintKind;
  message: string;
  plannerItemId?: number;
  blackoutId?: string;
};

function intervalsCrossList(a: TimeInterval[], b: TimeInterval[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (intervalsOverlap(x, y)) return true;
    }
  }
  return false;
}

type InfeasibilityHintParams = {
  items: PlannerItemRow[];
  packs: Record<string, CourseSolvePack>;
  blackouts: PlannerBlackoutsDocV1;
  /** Optional catalog for per-course blackout wording. */
  catalog?: PlannerCatalogJson | null;
  /** Skip the base solve when the caller already knows it returns no schedules. */
  baseAlreadyInfeasible?: boolean;
};

function courseLabel(item: PlannerItemRow): string {
  return `${item.subject} ${item.courseNumber}`;
}

/**
 * When the planner has courses but no valid combined schedule, return short
 * user-facing hints (best-effort, not exhaustive proof).
 */
export function computeInfeasibilityHints(
  params: InfeasibilityHintParams,
): InfeasibilityHint[] {
  const { items, packs, blackouts, catalog, baseAlreadyInfeasible = false } =
    params;
  if (items.length === 0) return [];

  const blackoutIntervals = blackoutsDocToTimeIntervals(blackouts);

  if (!baseAlreadyInfeasible) {
    const base = solveSchedulesFromPacks(items, packs, {
      blackoutIntervals,
      maxSolutions: 1,
    });
    if (base.solutions.length > 0) return [];
  }

  const hints: InfeasibilityHint[] = [];

  if (blackoutIntervals.length > 0) {
    const withoutBusy = solveSchedulesFromPacks(items, packs, {
      blackoutIntervals: [],
      maxSolutions: 1,
    });
    if (withoutBusy.solutions.length > 0) {
      hints.push({
        kind: "relax_busy",
        message:
          "A schedule exists if you remove or shrink busy times — try editing blocks that overlap typical class hours.",
      });
    }
  }

  for (const item of items) {
    if (item.selectionKind !== "unresolved") continue;
    const f = scheduleFiltersFromItem(item.scheduleFilters);
    if (f.requireOpenSections) {
      const relaxed = patchItemsScheduleFilters(
        items,
        { requireOpenSections: false },
        { itemId: item.id },
      );
      const probe = solveSchedulesFromPacks(relaxed, packs, {
        blackoutIntervals,
        maxSolutions: 1,
      });
      if (probe.solutions.length > 0) {
        hints.push({
          kind: "relax_exclude_full",
          message: `Turn off “Exclude full” for ${courseLabel(item)} to allow full sections.`,
          plannerItemId: item.id,
        });
        break;
      }
    }
  }

  for (const item of items) {
    if (item.selectionKind !== "unresolved") continue;
    const f = scheduleFiltersFromItem(item.scheduleFilters);
    if (f.excludeTba) {
      const relaxed = patchItemsScheduleFilters(
        items,
        { excludeTba: false },
        { itemId: item.id },
      );
      const probe = solveSchedulesFromPacks(relaxed, packs, {
        blackoutIntervals,
        maxSolutions: 1,
      });
      if (probe.solutions.length > 0) {
        hints.push({
          kind: "relax_exclude_tba",
          message: `Turn off “Exclude TBA times” for ${courseLabel(item)} to allow sections without a set meeting time.`,
          plannerItemId: item.id,
        });
        break;
      }
    }
  }

  for (const item of items) {
    if (item.selectionKind !== "unresolved") continue;
    const f = scheduleFiltersFromItem(item.scheduleFilters);
    if (f.excludeOnlineAsync) {
      const relaxed = patchItemsScheduleFilters(
        items,
        { excludeOnlineAsync: false },
        { itemId: item.id },
      );
      const probe = solveSchedulesFromPacks(relaxed, packs, {
        blackoutIntervals,
        maxSolutions: 1,
      });
      if (probe.solutions.length > 0) {
        hints.push({
          kind: "relax_exclude_online_async",
          message: `Turn off “Exclude online · async” for ${courseLabel(item)} to allow asynchronous online sections.`,
          plannerItemId: item.id,
        });
        break;
      }
    }
  }

  if (blackoutIntervals.length > 0 && catalog) {
    for (const item of items) {
      if (item.selectionKind !== "unresolved") continue;
      const key = courseSolvePackCourseKey(item.subject, item.courseNumber);
      const pack = packs[key];
      if (!pack?.candidates?.length) continue;

      let allHitBlackout = true;
      for (const cand of pack.candidates) {
        const candInts: TimeInterval[] = [];
        for (const crn of cand.crns) {
          const fromPack = pack.meetingsByCrn[crn];
          if (fromPack?.length) {
            candInts.push(...fromPack);
            continue;
          }
          for (const m of catalog.meetings) {
            if (m.sectionCrn !== crn) continue;
            candInts.push(...meetingRowToIntervals(m));
          }
        }
        if (candInts.length === 0) {
          allHitBlackout = false;
          break;
        }
        if (!intervalsCrossList(candInts, blackoutIntervals)) {
          allHitBlackout = false;
          break;
        }
      }

      if (allHitBlackout) {
        const label = courseLabel(item);
        const firstBo = blackouts.items[0];
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        if (firstBo) {
          const day = dayNames[firstBo.dayIndex] ?? "that day";
          hints.push({
            kind: "course_busy_conflict",
            message: `Every section pattern we see for ${label} crosses your busy time on ${day} — remove the course, clear that busy block, or relax filters for this course.`,
            plannerItemId: item.id,
            blackoutId: firstBo.id,
          });
        } else {
          hints.push({
            kind: "course_busy_conflict",
            message: `Every section pattern for ${label} conflicts with a busy time — try clearing busy blocks or relaxing filters for this course.`,
            plannerItemId: item.id,
          });
        }
        break;
      }
    }
  }

  if (hints.length === 0) {
    hints.push({
      kind: "generic",
      message:
        "No combination fits yet — relax instructor picks (choose “Any”), adjust busy times, or remove one course.",
    });
  }

  return hints;
}
