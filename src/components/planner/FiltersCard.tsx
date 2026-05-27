"use client";

import { useId } from "react";

import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics/track";

import { usePlannerSolve, usePlannerUi } from "./PlannerContext";

export function FiltersCard() {
  const { scheduleRecalculateSolutions } = usePlannerSolve();
  const {
    requireOpenSections,
    setRequireOpenSections,
    excludeTba,
    setExcludeTba,
    excludeOnlineAsync,
    setExcludeOnlineAsync,
  } = usePlannerUi();

  return (
    <section
      id="planner-filters"
      aria-labelledby="planner-filters-heading"
      className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
    >
      <h2
        id="planner-filters-heading"
        className="font-heading text-lg font-medium text-foreground"
      >
        Filters
      </h2>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        These limit which sections the planner can pick.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        <FilterSwitchRow
          id="exclude-full-toggle"
          label="Exclude full"
          checked={requireOpenSections}
          onCheckedChange={(next) => {
            setRequireOpenSections(next);
            track("planner_exclude_full_toggled", { on: next });
            scheduleRecalculateSolutions({ requireOpenSections: next });
          }}
        />
        <FilterSwitchRow
          id="exclude-tba-toggle"
          label="Exclude TBA times"
          checked={excludeTba}
          onCheckedChange={(next) => {
            setExcludeTba(next);
            track("planner_exclude_tba_toggled", { on: next });
            scheduleRecalculateSolutions({ excludeTba: next });
          }}
        />
        <FilterSwitchRow
          id="exclude-online-async-toggle"
          label="Exclude online · async"
          checked={excludeOnlineAsync}
          onCheckedChange={(next) => {
            setExcludeOnlineAsync(next);
            track("planner_exclude_online_async_toggled", { on: next });
            scheduleRecalculateSolutions({ excludeOnlineAsync: next });
          }}
        />
      </div>
    </section>
  );
}

type FilterSwitchRowProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function FilterSwitchRow({
  id,
  label,
  checked,
  onCheckedChange,
}: FilterSwitchRowProps) {
  const labelId = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label
        id={labelId}
        htmlFor={id}
        className="min-w-0 flex-1 cursor-pointer text-sm text-foreground"
      >
        {label}
      </label>
      <Switch
        id={id}
        aria-labelledby={labelId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="touch-manipulation"
      />
    </div>
  );
}
