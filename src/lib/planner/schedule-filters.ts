/** Hard filters applied during schedule solving (per planner item). */
export type PlannerScheduleFilters = {
  requireOpenSections: boolean;
  excludeTba: boolean;
  excludeOnlineAsync: boolean;
};

const DEFAULT_PLANNER_SCHEDULE_FILTERS: PlannerScheduleFilters = {
  requireOpenSections: true,
  excludeTba: true,
  excludeOnlineAsync: true,
};

/** Versioned JSON stored on each planner item (`scheduleFilters` column / localStorage). */
export type PlannerItemScheduleFiltersV1 = {
  v: 1;
  requireOpenSections: boolean;
  excludeTba: boolean;
  excludeOnlineAsync: boolean;
};

const EMPTY_FILTERS: PlannerItemScheduleFiltersV1 = {
  v: 1,
  ...DEFAULT_PLANNER_SCHEDULE_FILTERS,
};

export function defaultItemScheduleFilters(): PlannerItemScheduleFiltersV1 {
  return { v: 1, ...DEFAULT_PLANNER_SCHEDULE_FILTERS };
}

function boolField(o: Record<string, unknown>, key: string, fallback: boolean): boolean {
  return typeof o[key] === "boolean" ? o[key] : fallback;
}

export function parseItemScheduleFilters(raw: unknown): PlannerItemScheduleFiltersV1 {
  if (!raw || typeof raw !== "object") return { ...EMPTY_FILTERS };
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return { ...EMPTY_FILTERS };
  return {
    v: 1,
    requireOpenSections: boolField(
      o,
      "requireOpenSections",
      DEFAULT_PLANNER_SCHEDULE_FILTERS.requireOpenSections,
    ),
    excludeTba: boolField(o, "excludeTba", DEFAULT_PLANNER_SCHEDULE_FILTERS.excludeTba),
    excludeOnlineAsync: boolField(
      o,
      "excludeOnlineAsync",
      DEFAULT_PLANNER_SCHEDULE_FILTERS.excludeOnlineAsync,
    ),
  };
}

export function serializeItemScheduleFilters(
  f: PlannerItemScheduleFiltersV1,
): PlannerItemScheduleFiltersV1 {
  return {
    v: 1,
    requireOpenSections: f.requireOpenSections,
    excludeTba: f.excludeTba,
    excludeOnlineAsync: f.excludeOnlineAsync,
  };
}

/** True when any filter differs from the default (for carousel badge). */
export function itemHasNonDefaultScheduleFilters(raw: unknown): boolean {
  return activeScheduleFilterPillLabels(raw).length > 0;
}

type ScheduleFilterPillKey = keyof PlannerScheduleFilters;

type ScheduleFilterPill = {
  key: ScheduleFilterPillKey;
  label: string;
};

const SCHEDULE_FILTER_PILL_SPECS: ReadonlyArray<{
  key: ScheduleFilterPillKey;
  label: string;
}> = [
  { key: "requireOpenSections", label: "full" },
  { key: "excludeTba", label: "tba" },
  { key: "excludeOnlineAsync", label: "async" },
];

/** Default value for a schedule filter field (re-apply exclusion on dismiss). */
export function defaultScheduleFilterValue(
  key: keyof PlannerScheduleFilters,
): boolean {
  return DEFAULT_PLANNER_SCHEDULE_FILTERS[key];
}

/** Non-default schedule filters for carousel pills. */
export function activeScheduleFilterPills(raw: unknown): ScheduleFilterPill[] {
  const f = parseItemScheduleFilters(raw);
  return SCHEDULE_FILTER_PILL_SPECS.filter(
    ({ key }) => f[key] !== DEFAULT_PLANNER_SCHEDULE_FILTERS[key],
  ).map(({ key, label }) => ({ key, label }));
}

/** Short labels for non-default schedule filters (carousel pills). */
export function activeScheduleFilterPillLabels(raw: unknown): string[] {
  return activeScheduleFilterPills(raw).map((p) => p.label);
}

/** Solver-facing filter shape from a planner item row. */
export function scheduleFiltersFromItem(raw: unknown): PlannerScheduleFilters {
  const f = parseItemScheduleFilters(raw);
  return {
    requireOpenSections: f.requireOpenSections,
    excludeTba: f.excludeTba,
    excludeOnlineAsync: f.excludeOnlineAsync,
  };
}
