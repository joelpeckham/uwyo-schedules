import type { PlannerCatalogJson } from "./client/catalog-types";
import {
  buildMembersByBundleId,
  resolveItemDisplayCrns,
  resolvePlannerSwapClient,
} from "./client/derive";
import type { CalendarBlock, PlannerItemRow, SwapGhostMeeting } from "./data";
import { parseInstructorPrefs } from "./instructor-prefs";
import {
  allCrnsHaveOpenSeats,
  candidateViolatesHardInstructorPrefs,
  intervalsOverlap,
  meetingRowToIntervals,
  type CourseSolvePack,
  type ScheduleCandidate,
  type TimeInterval,
} from "./solve-schedules-core";
import { scheduleFiltersFromItem } from "./schedule-filters";
import {
  candidateViolatesDeliveryFilters,
  type DeliveryMode,
} from "@/lib/sections/delivery-mode";

function intervalsForCrns(
  catalog: PlannerCatalogJson,
  crns: readonly string[],
): TimeInterval[] {
  const set = new Set(crns);
  const out: TimeInterval[] = [];
  for (const m of catalog.meetings) {
    if (!set.has(m.sectionCrn)) continue;
    out.push(...meetingRowToIntervals(m));
  }
  return out;
}

function intervalsCross(a: TimeInterval[], b: TimeInterval[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (intervalsOverlap(x, y)) return true;
    }
  }
  return false;
}

/** Merge seat/faculty/schedule maps from prefetched course packs (same merge order as solve). */
export function mergePackConstraintMaps(packs: Record<string, CourseSolvePack>): {
  seatsByCrn: Map<
    string,
    { seatsAvailable: number | null; openSection: boolean | null }
  >;
  facultyByCrn: Map<
    string,
    { displayName: string | null; primaryIndicator: boolean | null }[]
  >;
  scheduleTypeByCrn: Map<string, string | null>;
  deliveryModeByCrn: Map<string, DeliveryMode>;
} {
  const seatsByCrn = new Map<
    string,
    { seatsAvailable: number | null; openSection: boolean | null }
  >();
  const facultyByCrn = new Map<
    string,
    { displayName: string | null; primaryIndicator: boolean | null }[]
  >();
  const scheduleTypeByCrn = new Map<string, string | null>();
  const deliveryModeByCrn = new Map<string, DeliveryMode>();
  for (const p of Object.values(packs)) {
    for (const [k, v] of Object.entries(p.seatsByCrn)) {
      if (!seatsByCrn.has(k)) seatsByCrn.set(k, v);
    }
    for (const [k, v] of Object.entries(p.facultyByCrn)) {
      if (!facultyByCrn.has(k)) facultyByCrn.set(k, v);
    }
    for (const [k, v] of Object.entries(p.scheduleTypeByCrn)) {
      if (!scheduleTypeByCrn.has(k)) scheduleTypeByCrn.set(k, v);
    }
    for (const [k, v] of Object.entries(p.deliveryModeByCrn ?? {})) {
      if (!deliveryModeByCrn.has(k)) deliveryModeByCrn.set(k, v);
    }
  }
  return { seatsByCrn, facultyByCrn, scheduleTypeByCrn, deliveryModeByCrn };
}

/**
 * Same-type swap ghost positions that still fit other pinned/auto sections,
 * busy times, open-seat mode, and hard instructor prefs.
 */
export function filterFeasibleSwapGhosts(params: {
  catalog: PlannerCatalogJson;
  draggedBlock: CalendarBlock;
  draggedPlannerItem: PlannerItemRow;
  /** Current schedule rows for other planner items (same order as DB). */
  otherEffectiveItems: PlannerItemRow[];
  blackoutIntervals: TimeInterval[];
  seatsByCrn: Map<
    string,
    { seatsAvailable: number | null; openSection: boolean | null }
  >;
  facultyByCrn: Map<
    string,
    { displayName: string | null; primaryIndicator: boolean | null }[]
  >;
  scheduleTypeByCrn: Map<string, string | null>;
  deliveryModeByCrn: Map<string, DeliveryMode>;
  rawGhosts: SwapGhostMeeting[];
  /**
   * When set (unresolved pin-drag), require ghost CRNs to be in this set in
   * addition to passing swap.ok. Pass `null` for "unknown" (e.g. packs still
   * loading) — ghosts are then allowed through and re-checked on commit.
   *
   * Computed once per drag start via
   * `feasibleSinglePinChoicesForDrag` so a single drag does not fan out
   * into one full DFS solve per ghost.
   */
  pinDragFeasiblePinnedCrns?: ReadonlySet<string> | null;
}): SwapGhostMeeting[] {
  const {
    catalog,
    draggedBlock,
    draggedPlannerItem,
    otherEffectiveItems,
    blackoutIntervals,
    seatsByCrn,
    facultyByCrn,
    scheduleTypeByCrn,
    deliveryModeByCrn,
    rawGhosts,
    pinDragFeasiblePinnedCrns,
  } = params;

  const draggedFilters = scheduleFiltersFromItem(draggedPlannerItem.scheduleFilters);
  const deliveryFilters = {
    excludeTba: draggedFilters.excludeTba,
    excludeOnlineAsync: draggedFilters.excludeOnlineAsync,
  };

  const membersByBundleId = buildMembersByBundleId(
    catalog.linkedBundleMembers,
  );

  const otherIntervals: TimeInterval[] = [];
  for (const item of otherEffectiveItems) {
    if (item.id === draggedPlannerItem.id) continue;
    for (const crn of resolveItemDisplayCrns(item, membersByBundleId)) {
      otherIntervals.push(...intervalsForCrns(catalog, [crn]));
    }
  }

  const feasibleCrns = new Set<string>();
  const seenCrn = new Set<string>();

  for (const g of rawGhosts) {
    if (g.crn === draggedBlock.sectionCrn) continue;
    if (seenCrn.has(g.crn)) continue;
    seenCrn.add(g.crn);

    const swap = resolvePlannerSwapClient(
      draggedPlannerItem,
      {
        targetCrn: g.crn,
        sourceSectionCrn: draggedBlock.sectionCrn,
        sourceMeetingId: draggedBlock.meetingId,
      },
      catalog,
    );
    if (!swap.ok) continue;

    if (pinDragFeasiblePinnedCrns !== undefined) {
      if (pinDragFeasiblePinnedCrns !== null && !pinDragFeasiblePinnedCrns.has(g.crn)) {
        continue;
      }
      feasibleCrns.add(g.crn);
      continue;
    }

    const patched: PlannerItemRow = {
      ...draggedPlannerItem,
      selectionKind: swap.selectionKind,
      anchorCrn: swap.anchorCrn,
      linkedBundleId: swap.linkedBundleId,
    };

    const crns = resolveItemDisplayCrns(patched, membersByBundleId);
    if (crns.length === 0) continue;

    if (
      draggedFilters.requireOpenSections &&
      !allCrnsHaveOpenSeats(crns, seatsByCrn)
    ) {
      continue;
    }

    if (
      candidateViolatesDeliveryFilters(crns, deliveryModeByCrn, deliveryFilters)
    ) {
      continue;
    }

    const cand: ScheduleCandidate = {
      selectionKind: swap.selectionKind,
      anchorCrn: swap.anchorCrn,
      linkedBundleId: swap.linkedBundleId,
      crns,
    };
    if (
      candidateViolatesHardInstructorPrefs(
        cand,
        parseInstructorPrefs(draggedPlannerItem.instructorPrefs),
        facultyByCrn,
        scheduleTypeByCrn,
      )
    ) {
      continue;
    }

    const newInts = intervalsForCrns(catalog, crns);
    if (intervalsCross(newInts, otherIntervals)) continue;
    if (intervalsCross(newInts, blackoutIntervals)) continue;

    feasibleCrns.add(g.crn);
  }

  return rawGhosts.filter((g) => feasibleCrns.has(g.crn));
}
