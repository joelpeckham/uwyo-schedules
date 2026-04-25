import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";

export type SelectionKind = "single_crn" | "linked_bundle";

export type PlannerItemSelection = {
  selectionKind: SelectionKind;
  anchorCrn: string;
  linkedBundleId: number | null;
};

/**
 * CRNs whose meetings should appear on the calendar for one planner row.
 */
export async function resolveDisplayCrns(
  db: Database,
  item: PlannerItemSelection,
): Promise<string[]> {
  if (item.selectionKind === "single_crn") {
    return [item.anchorCrn];
  }
  if (item.linkedBundleId == null) {
    return [item.anchorCrn];
  }
  const members = await db
    .select({ crn: schema.linkedBundleMembers.crn })
    .from(schema.linkedBundleMembers)
    .where(eq(schema.linkedBundleMembers.bundleId, item.linkedBundleId))
    .orderBy(schema.linkedBundleMembers.position);
  const memberCrns = members.map((m) => m.crn);
  const set = new Set<string>([item.anchorCrn, ...memberCrns]);
  return [...set];
}

/** Pure helper for tests: same logic without DB. */
export function resolveDisplayCrnsSync(
  item: PlannerItemSelection,
  memberCrnsOrdered: string[],
): string[] {
  if (item.selectionKind === "single_crn" || item.linkedBundleId == null) {
    return [item.anchorCrn];
  }
  return [...new Set([item.anchorCrn, ...memberCrnsOrdered])];
}

/** One query for all linked-bundle member lists (ordered by position). */
export async function loadOrderedMembersForBundleIds(
  db: Database,
  bundleIds: number[],
): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  if (bundleIds.length === 0) return out;
  const rows = await db
    .select({
      bundleId: schema.linkedBundleMembers.bundleId,
      crn: schema.linkedBundleMembers.crn,
      position: schema.linkedBundleMembers.position,
    })
    .from(schema.linkedBundleMembers)
    .where(inArray(schema.linkedBundleMembers.bundleId, bundleIds))
    .orderBy(
      schema.linkedBundleMembers.bundleId,
      asc(schema.linkedBundleMembers.position),
    );
  for (const r of rows) {
    const list = out.get(r.bundleId) ?? [];
    list.push(r.crn);
    out.set(r.bundleId, list);
  }
  return out;
}

export function resolveDisplayCrnsWithMemberMap(
  item: PlannerItemSelection,
  membersByBundleId: Map<number, string[]>,
): string[] {
  if (item.selectionKind === "single_crn" || item.linkedBundleId == null) {
    return [item.anchorCrn];
  }
  const members = membersByBundleId.get(item.linkedBundleId) ?? [];
  return resolveDisplayCrnsSync(item, members);
}
