import { blackoutsDocToTimeIntervals, type PlannerBlackoutsDocV1 } from "./blackouts";
import type { PlannerCatalogJson } from "./client/catalog-types";
import type { PlannerItemRow } from "./data";
import {
  courseSolvePackCourseKey,
  intervalsOverlap,
  meetingRowToIntervals,
  solveSchedulesFromPacks,
  type CourseSolvePack,
  type TimeInterval,
} from "./solve-schedules-core";

function intervalsCrossList(a: TimeInterval[], b: TimeInterval[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (intervalsOverlap(x, y)) return true;
    }
  }
  return false;
}

/**
 * When the planner has courses but no valid combined schedule, return short
 * user-facing hints (best-effort, not exhaustive proof).
 */
export function computeInfeasibilityHints(params: {
  items: PlannerItemRow[];
  packs: Record<string, CourseSolvePack>;
  blackouts: PlannerBlackoutsDocV1;
  requireOpenSections: boolean;
  /** Optional catalog for per-course blackout wording. */
  catalog?: PlannerCatalogJson | null;
}): string[] {
  const { items, packs, blackouts, requireOpenSections, catalog } = params;
  if (items.length === 0) return [];

  const blackoutIntervals = blackoutsDocToTimeIntervals(blackouts);

  const base = solveSchedulesFromPacks(items, packs, {
    requireOpenSections,
    blackoutIntervals,
    maxSolutions: 1,
  });
  if (base.solutions.length > 0) return [];

  const hints: string[] = [];

  const withoutBusy = solveSchedulesFromPacks(items, packs, {
    requireOpenSections,
    blackoutIntervals: [],
    maxSolutions: 1,
  });
  if (withoutBusy.solutions.length > 0) {
    hints.push(
      "A schedule exists if you remove or shrink busy times — try editing blocks that overlap typical class hours.",
    );
  }

  if (requireOpenSections) {
    const withSeatsOff = solveSchedulesFromPacks(items, packs, {
      requireOpenSections: false,
      blackoutIntervals,
      maxSolutions: 1,
    });
    if (withSeatsOff.solutions.length > 0) {
      hints.push(
        "Turn off “Exclude full” to allow full sections, then turn it on again once you see a pattern that works.",
      );
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
        const label = `${item.subject} ${item.courseNumber}`;
        const firstBo = blackouts.items[0];
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        if (firstBo) {
          const day = dayNames[firstBo.dayIndex] ?? "that day";
          hints.push(
            `Every section pattern we see for ${label} crosses your busy time on ${day} — remove the course, clear that busy block, or relax other filters.`,
          );
        } else {
          hints.push(
            `Every section pattern for ${label} conflicts with a busy time — try clearing busy blocks or removing the course.`,
          );
        }
        break;
      }
    }
  }

  if (hints.length === 0) {
    hints.push(
      "No combination fits yet — relax instructor picks (choose “Any”), adjust busy times, or remove one course.",
    );
  }

  return hints;
}
