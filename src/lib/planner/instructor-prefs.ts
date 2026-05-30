export type InstructorPrefsV1 = {
  v: 1;
  /**
   * Anchor (lecture) instructor prefs: substring match, case-insensitive.
   * The planner UI stores 0–1 chosen name; multiple entries are legacy / comma-era data.
   */
  primary: string[];
  /**
   * Linked bundle members (lab, discussion, …) keyed by `normalizeScheduleTypeKey`.
   * UI stores 0–1 name per key; multiple strings per key are legacy.
   */
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

export function hasInstructorPrefs(p: InstructorPrefsV1): boolean {
  if (p.primary.some((s) => s.trim().length > 0)) return true;
  if (p.byScheduleType) {
    for (const arr of Object.values(p.byScheduleType)) {
      if (arr.some((s) => s.trim().length > 0)) return true;
    }
  }
  return false;
}

/** True when any unresolved planner item has a primary or linked instructor filter. */
export function plannerHasAnyInstructorPrefs(
  items: ReadonlyArray<{ selectionKind: string; instructorPrefs: unknown }>,
): boolean {
  for (const item of items) {
    if (item.selectionKind !== "unresolved") continue;
    if (hasInstructorPrefs(parseInstructorPrefs(item.instructorPrefs))) return true;
  }
  return false;
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
