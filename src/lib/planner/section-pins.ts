import { normalizeScheduleTypeKey } from "@/lib/planner/swap-helpers";

const SECTION_PINS_DOC_VERSION = 1 as const;

type PlannerSectionPinsDocV1 = {
  v: typeof SECTION_PINS_DOC_VERSION;
  /** Normalized schedule-type key → pinned CRN for that type only. */
  byType: Record<string, string>;
};

export const EMPTY_SECTION_PINS: PlannerSectionPinsDocV1 = {
  v: SECTION_PINS_DOC_VERSION,
  byType: {},
};

export function parseSectionPinsJson(raw: unknown): PlannerSectionPinsDocV1 {
  if (raw == null) return { ...EMPTY_SECTION_PINS };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY_SECTION_PINS };
  const o = raw as Record<string, unknown>;
  if (o.v !== SECTION_PINS_DOC_VERSION) return { ...EMPTY_SECTION_PINS };
  const byTypeRaw = o.byType;
  if (typeof byTypeRaw !== "object" || byTypeRaw === null || Array.isArray(byTypeRaw)) {
    return { ...EMPTY_SECTION_PINS };
  }
  const byType: Record<string, string> = {};
  for (const [k, v] of Object.entries(byTypeRaw)) {
    if (typeof k !== "string" || k.length === 0) continue;
    if (typeof v !== "string" || v.trim().length === 0) continue;
    byType[k] = v.trim();
  }
  return { v: SECTION_PINS_DOC_VERSION, byType };
}

/**
 * Keep only candidates that include every pinned CRN and whose pinned CRN's
 * schedule type matches the pin key (normalized).
 */
export function filterCandidatesBySectionPins<T extends { crns: string[] }>(
  candidates: T[],
  pins: PlannerSectionPinsDocV1,
  scheduleTypeByCrn: Map<string, string | null>,
): T[] {
  const entries = Object.entries(pins.byType).filter(([, crn]) => crn.length > 0);
  if (entries.length === 0) return candidates;
  return candidates.filter((cand) => {
    for (const [typeKey, pinnedCrn] of entries) {
      if (!cand.crns.includes(pinnedCrn)) return false;
      const st = normalizeScheduleTypeKey(scheduleTypeByCrn.get(pinnedCrn) ?? null);
      if (st !== typeKey) return false;
    }
    return true;
  });
}
