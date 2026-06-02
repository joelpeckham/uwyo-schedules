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
 *   }
 *
 * Legacy links may include `tp` (time prefs); decode ignores it.
 */

import type { PlannerBlackoutsDocV1 } from "./blackouts";
import {
  defaultItemScheduleFilters,
  parseItemScheduleFilters,
  serializeItemScheduleFilters,
  type PlannerItemScheduleFiltersV1,
} from "./schedule-filters";

/** Compact per-course schedule filters in share links (1 = on / exclude, 0 = off). */
export type SharePinFiltersV1 = {
  /** Exclude full sections */
  f?: 0 | 1;
  /** Exclude TBA */
  t?: 0 | 1;
  /** Exclude online · async */
  o?: 0 | 1;
};

export type SharePinV1 = {
  /** Subject ("MATH"). */
  sub: string;
  /** Course number ("2200"). */
  num: string;
  /** Anchor CRN if pinned, else null (the planner picks the section). */
  crn: string | null;
  /** Linked-bundle id if pinned, else null. */
  lbid: number | null;
  /** Per-course schedule filters; omitted = all three exclusions on (default). */
  sf?: SharePinFiltersV1;
};

type ShareStateV1 = {
  v: 1;
  t: string;
  pins: SharePinV1[];
  bo: { d: number; s: number; e: number; l?: string }[];
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

type ShareInput = {
  termCode: string;
  pins: SharePinV1[];
  blackouts: PlannerBlackoutsDocV1;
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
    let sf: SharePinFiltersV1 | undefined;
    if (typeof r.sf === "object" && r.sf != null) {
      const s = r.sf as Record<string, unknown>;
      const f = s.f === 0 || s.f === 1 ? s.f : undefined;
      const t = s.t === 0 || s.t === 1 ? s.t : undefined;
      const o = s.o === 0 || s.o === 1 ? s.o : undefined;
      if (f !== undefined || t !== undefined || o !== undefined) {
        sf = { ...(f !== undefined ? { f } : {}), ...(t !== undefined ? { t } : {}), ...(o !== undefined ? { o } : {}) };
      }
    }
    pins.push({
      sub: r.sub,
      num: r.num,
      crn: typeof r.crn === "string" ? r.crn : null,
      lbid: typeof r.lbid === "number" ? r.lbid : null,
      ...(sf ? { sf } : {}),
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
  return { v: 1, t: obj.t, pins, bo };
}

/** Decode compact share filters into a planner item scheduleFilters doc. */
export function scheduleFiltersFromSharePin(
  sf?: SharePinFiltersV1,
): PlannerItemScheduleFiltersV1 {
  const d = defaultItemScheduleFilters();
  if (!sf) return d;
  return serializeItemScheduleFilters({
    v: 1,
    requireOpenSections: sf.f === 0 ? false : d.requireOpenSections,
    excludeTba: sf.t === 0 ? false : d.excludeTba,
    excludeOnlineAsync: sf.o === 0 ? false : d.excludeOnlineAsync,
  });
}

/** Encode item filters for share when any differ from default (all exclusions on). */
export function shareFiltersFromItem(
  scheduleFilters: unknown,
): SharePinFiltersV1 | undefined {
  const f = parseItemScheduleFilters(scheduleFilters);
  const d = defaultItemScheduleFilters();
  if (
    f.requireOpenSections === d.requireOpenSections &&
    f.excludeTba === d.excludeTba &&
    f.excludeOnlineAsync === d.excludeOnlineAsync
  ) {
    return undefined;
  }
  return {
    f: f.requireOpenSections ? 1 : 0,
    t: f.excludeTba ? 1 : 0,
    o: f.excludeOnlineAsync ? 1 : 0,
  };
}
