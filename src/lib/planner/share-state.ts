/**
 * Encode/decode a small, lossless snapshot of the planner state into a URL
 * query parameter (`?s=<base64url>`). The shape is intentionally tiny so the
 * resulting link stays under typical URL limits even with a dozen courses
 * pinned and a half-dozen blackouts.
 *
 * v1 payload:
 *   {
 *     v: 1,
 *     t: termCode,
 *     pins: { sub: string; num: string; crn: string | null; lbid: number | null }[],
 *     bo:  { d: dayIndex; s: start; e: end; l?: label }[],
 *     tp:  { nf?: 1; nb?: minutes; na?: minutes; pl?: [start, end] },
 *   }
 */

import type { PlannerBlackoutsDocV1 } from "./blackouts";
import type { PlannerTimePrefsV1 } from "./time-prefs";

export type SharePinV1 = {
  /** Subject ("MATH"). */
  sub: string;
  /** Course number ("2200"). */
  num: string;
  /** Anchor CRN if pinned, else null (the planner picks the section). */
  crn: string | null;
  /** Linked-bundle id if pinned, else null. */
  lbid: number | null;
};

export type ShareStateV1 = {
  v: 1;
  t: string;
  pins: SharePinV1[];
  bo: { d: number; s: number; e: number; l?: string }[];
  tp: { nf?: 1; nb?: number; na?: number; pl?: [number, number] };
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

export type ShareInput = {
  termCode: string;
  pins: SharePinV1[];
  blackouts: PlannerBlackoutsDocV1;
  timePrefs: PlannerTimePrefsV1;
};

export function encodeShareState(input: ShareInput): string {
  const doc: ShareStateV1 = {
    v: 1,
    t: input.termCode,
    pins: input.pins,
    bo: input.blackouts.items.map((b) => ({
      d: b.dayIndex,
      s: b.start,
      e: b.end,
      ...(b.label ? { l: b.label } : {}),
    })),
    tp: {
      ...(input.timePrefs.noFridays ? { nf: 1 as const } : {}),
      ...(input.timePrefs.noBefore != null ? { nb: input.timePrefs.noBefore } : {}),
      ...(input.timePrefs.noAfter != null ? { na: input.timePrefs.noAfter } : {}),
      ...(input.timePrefs.protectLunch
        ? {
            pl: [
              input.timePrefs.protectLunch.start,
              input.timePrefs.protectLunch.end,
            ] as [number, number],
          }
        : {}),
    },
  };
  return toBase64Url(JSON.stringify(doc));
}

export function decodeShareState(raw: string): ShareStateV1 | null {
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
  if (obj.v !== 1) return null;
  if (typeof obj.t !== "string") return null;
  if (!Array.isArray(obj.pins)) return null;
  const pins: SharePinV1[] = [];
  for (const p of obj.pins) {
    if (typeof p !== "object" || p == null) continue;
    const r = p as Record<string, unknown>;
    if (typeof r.sub !== "string" || typeof r.num !== "string") continue;
    pins.push({
      sub: r.sub,
      num: r.num,
      crn: typeof r.crn === "string" ? r.crn : null,
      lbid: typeof r.lbid === "number" ? r.lbid : null,
    });
  }
  const bo: { d: number; s: number; e: number; l?: string }[] = [];
  if (Array.isArray(obj.bo)) {
    for (const b of obj.bo) {
      if (typeof b !== "object" || b == null) continue;
      const r = b as Record<string, unknown>;
      if (
        typeof r.d !== "number" ||
        typeof r.s !== "number" ||
        typeof r.e !== "number"
      )
        continue;
      bo.push({
        d: r.d,
        s: r.s,
        e: r.e,
        ...(typeof r.l === "string" && r.l.length > 0 ? { l: r.l } : {}),
      });
    }
  }
  const tpRaw = (obj.tp ?? {}) as Record<string, unknown>;
  const tp: ShareStateV1["tp"] = {};
  if (tpRaw.nf === 1) tp.nf = 1;
  if (typeof tpRaw.nb === "number") tp.nb = tpRaw.nb;
  if (typeof tpRaw.na === "number") tp.na = tpRaw.na;
  if (
    Array.isArray(tpRaw.pl) &&
    tpRaw.pl.length === 2 &&
    typeof tpRaw.pl[0] === "number" &&
    typeof tpRaw.pl[1] === "number"
  ) {
    tp.pl = [tpRaw.pl[0], tpRaw.pl[1]];
  }
  return { v: 1, t: obj.t, pins, bo, tp };
}
