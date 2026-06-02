/**
 * Server-backed share payload for planner shortlinks (`?s=<code>`).
 */

import type { PlannerBlackoutsDocV1 } from "./blackouts";
import { parseBlackoutsJson } from "./blackouts";
import type { PlannerItemRow } from "./data";
import { normalizePlannerItems } from "./local-state";

export type SharePayloadV1 = {
  v: 1;
  termCode: string;
  items: PlannerItemRow[];
  blackouts: PlannerBlackoutsDocV1;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function buildSharePayload(input: {
  termCode: string;
  items: PlannerItemRow[];
  blackouts: PlannerBlackoutsDocV1;
}): SharePayloadV1 {
  return {
    v: 1,
    termCode: input.termCode,
    items: input.items,
    blackouts: input.blackouts,
  };
}

/** Validate a stored JSON payload from `planner_shares.payload`. */
export function parseSharePayload(raw: unknown): SharePayloadV1 | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  if (typeof raw.termCode !== "string" || !raw.termCode.trim()) return null;
  return {
    v: 1,
    termCode: raw.termCode,
    items: normalizePlannerItems(raw.items),
    blackouts: parseBlackoutsJson(raw.blackouts),
  };
}
