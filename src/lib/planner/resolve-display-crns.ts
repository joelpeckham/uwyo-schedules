import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

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
