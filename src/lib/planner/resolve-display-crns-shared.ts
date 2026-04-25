export type SelectionKind = "unresolved" | "single_crn" | "linked_bundle";

export type PlannerItemSelection = {
  selectionKind: SelectionKind;
  anchorCrn: string | null;
  linkedBundleId: number | null;
};

/** Pure helper for tests and client solve: same logic without DB. */
export function resolveDisplayCrnsSync(
  item: PlannerItemSelection,
  memberCrnsOrdered: string[],
): string[] {
  if (item.selectionKind === "unresolved" || item.anchorCrn == null) {
    return [];
  }
  if (item.selectionKind === "single_crn" || item.linkedBundleId == null) {
    return [item.anchorCrn];
  }
  return [...new Set([item.anchorCrn, ...memberCrnsOrdered])];
}

export function resolveDisplayCrnsWithMemberMap(
  item: PlannerItemSelection,
  membersByBundleId: Map<number, string[]>,
): string[] {
  if (item.selectionKind === "unresolved" || item.anchorCrn == null) {
    return [];
  }
  if (item.selectionKind === "single_crn" || item.linkedBundleId == null) {
    return [item.anchorCrn];
  }
  const members = membersByBundleId.get(item.linkedBundleId) ?? [];
  return resolveDisplayCrnsSync(item, members);
}

/** Resolved registration only (for solver output and validation). */
export type ResolvedPlannerSelection = {
  selectionKind: "single_crn" | "linked_bundle";
  anchorCrn: string;
  linkedBundleId: number | null;
};
