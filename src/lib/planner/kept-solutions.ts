import type { ScheduleSolution } from "./solve-schedules-core";

/**
 * Order-independent fingerprint of a solution. Each selection contributes
 * `anchorCrn` plus `linkedBundleId` (when set) so two solutions that pick
 * the same anchor with different linked bundles compare unequal.
 */
export function solutionFingerprint(solution: ScheduleSolution): string {
  const tokens: string[] = [];
  for (const sel of Object.values(solution.selections)) {
    if (!sel.anchorCrn) continue;
    if (sel.selectionKind === "linked_bundle" && sel.linkedBundleId != null) {
      tokens.push(`${sel.anchorCrn}#${sel.linkedBundleId}`);
    } else {
      tokens.push(sel.anchorCrn);
    }
  }
  tokens.sort();
  return tokens.join(":");
}

/** Index of `solution` in `solutions` whose fingerprint matches `key`, or -1. */
export function findSolutionIndexByFingerprint(
  solutions: ScheduleSolution[],
  key: string,
): number {
  for (let i = 0; i < solutions.length; i++) {
    if (solutionFingerprint(solutions[i]!) === key) return i;
  }
  return -1;
}
