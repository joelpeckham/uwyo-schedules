import { describe, expect, it } from "vitest";
import {
  activeScheduleFilterPillLabels,
  activeScheduleFilterPills,
  defaultItemScheduleFilters,
  defaultScheduleFilterValue,
  itemHasNonDefaultScheduleFilters,
  serializeItemScheduleFilters,
} from "./schedule-filters";

describe("activeScheduleFilterPills", () => {
  it("returns no pills for default filters", () => {
    expect(
      activeScheduleFilterPills(
        serializeItemScheduleFilters(defaultItemScheduleFilters()),
      ),
    ).toEqual([]);
    expect(itemHasNonDefaultScheduleFilters(null)).toBe(false);
  });

  it("returns one pill per relaxed filter with stable keys", () => {
    const base = defaultItemScheduleFilters();
    expect(
      activeScheduleFilterPills(
        serializeItemScheduleFilters({
          ...base,
          requireOpenSections: false,
        }),
      ),
    ).toEqual([{ key: "requireOpenSections", label: "full" }]);
    expect(
      activeScheduleFilterPills(
        serializeItemScheduleFilters({ ...base, excludeTba: false }),
      ),
    ).toEqual([{ key: "excludeTba", label: "tba" }]);
    expect(
      activeScheduleFilterPills(
        serializeItemScheduleFilters({ ...base, excludeOnlineAsync: false }),
      ),
    ).toEqual([{ key: "excludeOnlineAsync", label: "async" }]);
  });

  it("returns pills in stable order when multiple filters differ", () => {
    const base = defaultItemScheduleFilters();
    expect(
      activeScheduleFilterPills(
        serializeItemScheduleFilters({
          ...base,
          requireOpenSections: false,
          excludeTba: false,
          excludeOnlineAsync: false,
        }),
      ),
    ).toEqual([
      { key: "requireOpenSections", label: "full" },
      { key: "excludeTba", label: "tba" },
      { key: "excludeOnlineAsync", label: "async" },
    ]);
    expect(
      activeScheduleFilterPillLabels(
        serializeItemScheduleFilters({
          ...base,
          requireOpenSections: false,
          excludeTba: false,
          excludeOnlineAsync: false,
        }),
      ),
    ).toEqual(["full", "tba", "async"]);
  });
});

describe("defaultScheduleFilterValue", () => {
  it("matches default item schedule filters", () => {
    const defaults = defaultItemScheduleFilters();
    expect(defaultScheduleFilterValue("requireOpenSections")).toBe(
      defaults.requireOpenSections,
    );
    expect(defaultScheduleFilterValue("excludeTba")).toBe(defaults.excludeTba);
    expect(defaultScheduleFilterValue("excludeOnlineAsync")).toBe(
      defaults.excludeOnlineAsync,
    );
  });
});
