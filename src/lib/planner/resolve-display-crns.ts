import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { asc, inArray } from "drizzle-orm";

export type { PlannerItemSelection } from "./resolve-display-crns-shared";
export { resolveDisplayCrnsSync, resolveDisplayCrnsWithMemberMap } from "./resolve-display-crns-shared";

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
