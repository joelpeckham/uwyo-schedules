import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import type { PlannerItemRow } from "@/lib/planner/data";
import { parseItemScheduleFilters } from "@/lib/planner/schedule-filters";
import { parseSectionPinsJson } from "@/lib/planner/section-pins";
import { resolveDisplayCrnsWithMemberMap } from "@/lib/planner/resolve-display-crns-shared";
import type { CourseSolvePack } from "@/lib/planner/solve-schedules-core";

type SeatRow = {
  seatsAvailable: number | null;
  openSection: boolean | null;
};

function buildMembersByBundleId(
  members: PlannerCatalogJson["linkedBundleMembers"],
): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const m of members) {
    const list = map.get(m.bundleId) ?? [];
    list.push(m.crn);
    map.set(m.bundleId, list);
  }
  return map;
}

function buildSeatsByCrn(packs: CourseSolvePack[]): Map<string, SeatRow> {
  const map = new Map<string, SeatRow>();
  for (const pack of packs) {
    for (const [crn, row] of Object.entries(pack.seatsByCrn)) {
      map.set(crn, row);
    }
  }
  return map;
}

/** Mirrors solver `allCrnsHaveOpenSeats` — missing rows count as closed. */
export function isCrnClosed(
  seatsByCrn: Map<string, SeatRow>,
  crn: string,
): boolean {
  const row = seatsByCrn.get(crn);
  if (!row) return true;
  if (row.seatsAvailable != null && row.seatsAvailable <= 0) return true;
  if (row.openSection === false) return true;
  return false;
}

function relevantCrnsForItem(
  item: PlannerItemRow,
  membersByBundleId: Map<number, string[]>,
): string[] {
  if (item.selectionKind === "single_crn" && item.anchorCrn) {
    return [item.anchorCrn];
  }
  if (item.selectionKind === "linked_bundle" && item.anchorCrn) {
    return resolveDisplayCrnsWithMemberMap(item, membersByBundleId);
  }
  if (item.selectionKind === "unresolved") {
    const pins = parseSectionPinsJson(item.sectionPins);
    return Object.values(pins.byType).filter(Boolean);
  }
  return [];
}

type SeatAuditHit = {
  id: number;
  subject: string;
  courseNumber: string;
};

/**
 * Items whose saved/pinned sections are now full while "Exclude full" is on.
 */
export function auditItemsWithFullSavedSections(
  items: PlannerItemRow[],
  packs: CourseSolvePack[],
  catalog: PlannerCatalogJson,
): SeatAuditHit[] {
  const seatsByCrn = buildSeatsByCrn(packs);
  const membersByBundleId = buildMembersByBundleId(catalog.linkedBundleMembers);
  const hits: SeatAuditHit[] = [];

  for (const item of items) {
    const filters = parseItemScheduleFilters(item.scheduleFilters);
    if (!filters.requireOpenSections) continue;

    const crns = relevantCrnsForItem(item, membersByBundleId);
    if (crns.length === 0) continue;

    if (crns.some((crn) => isCrnClosed(seatsByCrn, crn))) {
      hits.push({
        id: item.id,
        subject: item.subject,
        courseNumber: item.courseNumber,
      });
    }
  }

  return hits;
}
