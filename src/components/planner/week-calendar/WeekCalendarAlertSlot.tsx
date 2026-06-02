"use client";

import type { ReactNode } from "react";

import { ScheduleHelpDialog } from "./schedule-help-dialog";

/**
 * Title bar with right-aligned settings and help. Fixed height so toolbar/grid
 * position does not shift when overlays appear.
 */
export function WeekCalendarAlertSlot({ trailing }: { trailing?: ReactNode }) {
  return (
    <div className="flex h-11 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
      <h2
        id="planner-week-calendar-heading"
        className="font-heading shrink-0 text-base font-medium text-foreground"
      >
        Weekly schedule
      </h2>
      <div className="flex shrink-0 items-center gap-0.5">
        {trailing}
        <ScheduleHelpDialog />
      </div>
    </div>
  );
}
