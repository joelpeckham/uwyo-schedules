/** Hard filters applied during schedule solving (session UI state, not persisted). */
export type PlannerScheduleFilters = {
  requireOpenSections: boolean;
  excludeTba: boolean;
  excludeOnlineAsync: boolean;
};

export const DEFAULT_PLANNER_SCHEDULE_FILTERS: PlannerScheduleFilters = {
  requireOpenSections: true,
  excludeTba: true,
  excludeOnlineAsync: true,
};
