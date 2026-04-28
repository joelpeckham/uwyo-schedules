import type { ScheduleSolution } from "./solve-schedules-core";

/**
 * Versioned storage for "kept" schedule fingerprints. The list is small and
 * survives a recalc by matching CRN-set fingerprints against the freshly
 * generated `solutions` array (a kept solution is "still around" when its
 * fingerprint matches some new solution).
 */
export type PlannerKeptSolutionsDocV1 = {
  v: 1;
  keys: string[];
};

export const EMPTY_KEPT_SOLUTIONS: PlannerKeptSolutionsDocV1 = {
  v: 1,
  keys: [],
};

/** Hard ceiling so we never blow past Postgres jsonb size in pathological cases. */
export const MAX_KEPT_SOLUTIONS = 12;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function parseKeptSolutionsJson(raw: unknown): PlannerKeptSolutionsDocV1 {
  if (!isRecord(raw)) return EMPTY_KEPT_SOLUTIONS;
  if (raw.v !== 1) return EMPTY_KEPT_SOLUTIONS;
  const keysRaw = raw.keys;
  if (!Array.isArray(keysRaw)) return EMPTY_KEPT_SOLUTIONS;
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const k of keysRaw) {
    if (typeof k !== "string") continue;
    if (k.length === 0 || k.length > 1024) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    keys.push(k);
    if (keys.length >= MAX_KEPT_SOLUTIONS) break;
  }
  return { v: 1, keys };
}

export function stableKeptSolutionsJsonForDb(
  doc: PlannerKeptSolutionsDocV1,
): unknown {
  return { v: 1 as const, keys: doc.keys.slice(0, MAX_KEPT_SOLUTIONS) };
}

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
