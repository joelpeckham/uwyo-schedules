import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import type { PlannerItemSelection } from "./resolve-display-crns-shared";

export type {
  PlannerItemSelection,
  ResolvedPlannerSelection,
  SelectionKind,
} from "./resolve-display-crns-shared";
export { resolveDisplayCrnsSync, resolveDisplayCrnsWithMemberMap } from "./resolve-display-crns-shared";

/**
 * CRNs whose meetings should appear on the calendar for one planner row.
 */
export async function resolveDisplayCrns(
  db: Database,
  item: PlannerItemSelection,
): Promise<string[]> {
  if (item.selectionKind === "unresolved" || item.anchorCrn == null) {
    return [];
  }
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
