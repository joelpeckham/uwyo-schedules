"use client";

import { Settings } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { usePlannerViewSettings } from "@/lib/planner/planner-view-settings";

export function PlannerSettingsMenu() {
  const {
    showCourseSelector,
    showFilters,
    showTransitionWarnings,
    setShowCourseSelector,
    setShowFilters,
    setShowTransitionWarnings,
  } = usePlannerViewSettings();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="touch-manipulation"
          aria-label="Planner settings"
        >
          <Settings className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="px-4 py-3">
          <p className="font-heading text-sm font-medium text-foreground">
            Display
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <SettingSwitchRow
              id="planner-show-course-selector"
              label="Course selector"
              checked={showCourseSelector}
              onCheckedChange={setShowCourseSelector}
            />
            <SettingSwitchRow
              id="planner-show-filters"
              label="Filters"
              checked={showFilters}
              onCheckedChange={setShowFilters}
            />
          </div>
        </div>
        <div className="border-t border-border px-4 py-3">
          <SettingSwitchRow
            id="planner-show-transition-warnings"
            label="Transition-time warnings"
            checked={showTransitionWarnings}
            onCheckedChange={setShowTransitionWarnings}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

type SettingSwitchRowProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function SettingSwitchRow({
  id,
  label,
  checked,
  onCheckedChange,
}: SettingSwitchRowProps) {
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
