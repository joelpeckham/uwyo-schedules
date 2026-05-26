"use client";

import { useCallback, useId } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics/track";
import {
  DEFAULT_PROTECT_LUNCH,
  type PlannerTimePrefsV1,
} from "@/lib/planner/time-prefs";
import { cn } from "@/lib/utils";

import { usePlannerSolve, usePlannerUi } from "./PlannerContext";

const NO_BEFORE_OPTIONS = [
  { value: 8 * 60, label: "8 a.m." },
  { value: 9 * 60, label: "9 a.m." },
  { value: 10 * 60, label: "10 a.m." },
  { value: 11 * 60, label: "11 a.m." },
];

const NO_AFTER_OPTIONS = [
  { value: 16 * 60, label: "4 p.m." },
  { value: 17 * 60, label: "5 p.m." },
  { value: 18 * 60, label: "6 p.m." },
  { value: 19 * 60, label: "7 p.m." },
  { value: 20 * 60, label: "8 p.m." },
];

const NONE = "none";

export function FiltersCard() {
  const { scheduleRecalculateSolutions } = usePlannerSolve();
  const {
    timePrefs,
    setTimePrefs,
    requireOpenSections,
    setRequireOpenSections,
    excludeTba,
    setExcludeTba,
    excludeOnlineAsync,
    setExcludeOnlineAsync,
  } = usePlannerUi();

  const setNoFridays = useCallback(
    (next: boolean) => {
      setTimePrefs((prev) => {
        const out: PlannerTimePrefsV1 = { ...prev };
        if (next) {
          out.noFridays = true;
        } else {
          delete out.noFridays;
        }
        return out;
      });
      track("planner_time_pref_changed", { kind: "noFridays", on: next });
    },
    [setTimePrefs],
  );

  const setProtectLunch = useCallback(
    (next: boolean) => {
      setTimePrefs((prev) => {
        const out: PlannerTimePrefsV1 = { ...prev };
        if (next) {
          out.protectLunch = { ...DEFAULT_PROTECT_LUNCH };
        } else {
          delete out.protectLunch;
        }
        return out;
      });
      track("planner_time_pref_changed", { kind: "protectLunch", on: next });
    },
    [setTimePrefs],
  );

  const setNoBefore = useCallback(
    (raw: string) => {
      const minutes = raw === NONE ? null : Number.parseInt(raw, 10);
      setTimePrefs((prev) => {
        const out: PlannerTimePrefsV1 = { ...prev };
        if (minutes != null && Number.isFinite(minutes)) {
          out.noBefore = minutes;
        } else {
          delete out.noBefore;
        }
        return out;
      });
      track("planner_time_pref_changed", {
        kind: "noBefore",
        on: minutes != null,
        ...(minutes != null ? { minutes } : {}),
      });
    },
    [setTimePrefs],
  );

  const setNoAfter = useCallback(
    (raw: string) => {
      const minutes = raw === NONE ? null : Number.parseInt(raw, 10);
      setTimePrefs((prev) => {
        const out: PlannerTimePrefsV1 = { ...prev };
        if (minutes != null && Number.isFinite(minutes)) {
          out.noAfter = minutes;
        } else {
          delete out.noAfter;
        }
        return out;
      });
      track("planner_time_pref_changed", {
        kind: "noAfter",
        on: minutes != null,
        ...(minutes != null ? { minutes } : {}),
      });
    },
    [setTimePrefs],
  );

  const noBeforeValue =
    timePrefs.noBefore != null ? String(timePrefs.noBefore) : NONE;
  const noAfterValue =
    timePrefs.noAfter != null ? String(timePrefs.noAfter) : NONE;

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

      <div
        className="my-4 border-t border-border"
        role="separator"
        aria-hidden
      />

      <h3 className="text-sm font-medium text-foreground">Time of day</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Soft preferences. The planner ranks weeks that match you higher; it
        won&rsquo;t hide a week that conflicts.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <PrefPill
          on={timePrefs.noFridays === true}
          onClick={() => setNoFridays(timePrefs.noFridays !== true)}
        >
          No Fridays
        </PrefPill>
        <PrefPill
          on={!!timePrefs.protectLunch}
          onClick={() => setProtectLunch(!timePrefs.protectLunch)}
        >
          Lunch free
        </PrefPill>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            No earlier than
          </label>
          <Select value={noBeforeValue} onValueChange={setNoBefore}>
            <SelectTrigger size="sm" className="mt-1 w-full font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Any time</SelectItem>
              {NO_BEFORE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            No later than
          </label>
          <Select value={noAfterValue} onValueChange={setNoAfter}>
            <SelectTrigger size="sm" className="mt-1 w-full font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Any time</SelectItem>
              {NO_AFTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

type PrefPillProps = {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function PrefPill({ on, onClick, children }: PrefPillProps) {
  return (
    <Button
      type="button"
      variant={on ? "default" : "outline"}
      size="sm"
      aria-pressed={on}
      onClick={onClick}
      className={cn("h-7 touch-manipulation", on && "shadow-sm")}
    >
      {children}
    </Button>
  );
}
