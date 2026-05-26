/**
 * Encode/decode resolved section selections for the print view (`?p=<base64url>`).
 * Captures the same registrations the on-screen calendar shows via
 * `effectivePlannerItems`, without re-running the solver in the export tab.
 *
 * v1 payload: `{ v: 1, s: PrintSelectionRowV1[] }`
 * Each row: `{ id, k: "s"|"l", c: anchorCrn, b?: linkedBundleId }`
 */

import type { PlannerItemRow } from "./data";
import type { ResolvedPlannerSelection } from "./resolve-display-crns-shared";

export type PrintSelectionRowV1 = {
  id: number;
  /** `s` = single_crn, `l` = linked_bundle */
  k: "s" | "l";
  c: string;
  b?: number;
};

export type PrintSelectionsDocV1 = {
  v: 1;
  s: PrintSelectionRowV1[];
};

function toBase64Url(s: string): string {
  if (typeof btoa === "function") {
    const b64 = btoa(unescape(encodeURIComponent(s)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  if (typeof atob === "function") {
    return decodeURIComponent(escape(atob(padded + pad)));
  }
  return Buffer.from(padded + pad, "base64").toString("utf8");
}

export function selectionsFromPlannerItems(
  items: PlannerItemRow[],
): Record<number, ResolvedPlannerSelection> {
  const out: Record<number, ResolvedPlannerSelection> = {};
  for (const item of items) {
    if (item.selectionKind === "unresolved" || item.anchorCrn == null) continue;
    out[item.id] = {
      selectionKind: item.selectionKind,
      anchorCrn: item.anchorCrn,
      linkedBundleId: item.linkedBundleId,
    };
  }
  return out;
}

export function encodePrintSelections(items: PlannerItemRow[]): string {
  const s: PrintSelectionRowV1[] = [];
  for (const item of items) {
    if (item.selectionKind === "unresolved" || item.anchorCrn == null) continue;
    const row: PrintSelectionRowV1 = {
      id: item.id,
      k: item.selectionKind === "linked_bundle" ? "l" : "s",
      c: item.anchorCrn,
    };
    if (item.linkedBundleId != null) row.b = item.linkedBundleId;
    s.push(row);
  }
  const doc: PrintSelectionsDocV1 = { v: 1, s };
  return toBase64Url(JSON.stringify(doc));
}

function rowToSelection(row: PrintSelectionRowV1): ResolvedPlannerSelection | null {
  if (!Number.isFinite(row.id) || typeof row.c !== "string" || row.c.length === 0) {
    return null;
  }
  if (row.k === "s") {
    return {
      selectionKind: "single_crn",
      anchorCrn: row.c,
      linkedBundleId: null,
    };
  }
  if (row.k === "l") {
    return {
      selectionKind: "linked_bundle",
      anchorCrn: row.c,
      linkedBundleId: typeof row.b === "number" ? row.b : null,
    };
  }
  return null;
}

export function decodePrintSelections(
  raw: string,
): Record<number, ResolvedPlannerSelection> | null {
  if (raw.length === 0 || raw.length > 8192) return null;
  let json: string;
  try {
    json = fromBase64Url(raw);
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed == null) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.v !== 1 || !Array.isArray(obj.s)) return null;

  const out: Record<number, ResolvedPlannerSelection> = {};
  for (const entry of obj.s) {
    if (typeof entry !== "object" || entry == null) continue;
    const r = entry as Record<string, unknown>;
    if (typeof r.id !== "number") continue;
    if (r.k !== "s" && r.k !== "l") continue;
    const row: PrintSelectionRowV1 = {
      id: r.id,
      k: r.k,
      c: typeof r.c === "string" ? r.c : "",
      ...(typeof r.b === "number" ? { b: r.b } : {}),
    };
    const sel = rowToSelection(row);
    if (sel) out[row.id] = sel;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function applyResolvedSelectionsToPlannerItems(
  items: PlannerItemRow[],
  selections: Record<number, ResolvedPlannerSelection>,
): PlannerItemRow[] {
  return items.map((row) => {
    const sel = selections[row.id];
    if (!sel) return row;
    return {
      ...row,
      selectionKind: sel.selectionKind,
      anchorCrn: sel.anchorCrn,
      linkedBundleId: sel.linkedBundleId,
    };
  });
}
