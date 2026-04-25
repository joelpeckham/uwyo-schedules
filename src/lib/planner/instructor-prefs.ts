export type InstructorPrefsV1 = {
  v: 1;
  /** Ordered preferred names (substring match, case-insensitive) for anchor / primary lecture. */
  primary: string[];
  /** Optional prefs keyed by `normalizeScheduleTypeKey` for non-lecture parts of a bundle. */
  byScheduleType?: Record<string, string[]>;
};

const EMPTY: InstructorPrefsV1 = { v: 1, primary: [] };

export function defaultInstructorPrefs(): InstructorPrefsV1 {
  return { v: 1, primary: [] };
}

export function parseInstructorPrefs(raw: unknown): InstructorPrefsV1 {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return { ...EMPTY };
  const primary = Array.isArray(o.primary)
    ? o.primary.filter((x): x is string => typeof x === "string")
    : [];
  let byScheduleType: Record<string, string[]> | undefined;
  if (o.byScheduleType && typeof o.byScheduleType === "object") {
    const m: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(o.byScheduleType as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        m[k] = v.filter((x): x is string => typeof x === "string");
      }
    }
    if (Object.keys(m).length > 0) byScheduleType = m;
  }
  return { v: 1, primary, byScheduleType };
}

export function serializeInstructorPrefs(p: InstructorPrefsV1): InstructorPrefsV1 {
  return {
    v: 1,
    primary: p.primary.map((s) => s.trim()).filter(Boolean),
    byScheduleType: p.byScheduleType
      ? Object.fromEntries(
          Object.entries(p.byScheduleType).map(([k, arr]) => [
            k,
            arr.map((s) => s.trim()).filter(Boolean),
          ]),
        )
      : undefined,
  };
}
