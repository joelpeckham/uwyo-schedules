"use client";

import type { ReactNode } from "react";

import { FirstRunTourSlot } from "./FirstRunTourSlot";

type WeekCalendarToolbarProps = {
  plannerItemCount: number;
  /** When `null`, skip the first-run tour slot (e.g. landing preview). */
  tourSlot?: ReactNode | null;
  meta?: ReactNode;
  exportSlot: ReactNode;
  actions: ReactNode;
};

/**
 * Week calendar header: two rows by default, single row when the calendar
 * column is wide enough for title + actions side by side (@3xl/toolbar).
 */
export function WeekCalendarToolbar({
  plannerItemCount,
  tourSlot,
  meta,
  exportSlot,
  actions,
}: WeekCalendarToolbarProps) {
  return (
    <div
      className="@container/toolbar border-b border-border p-3 sm:p-4"
      id="planner-week-calendar-toolbar"
    >
      {tourSlot !== undefined ? (
        tourSlot
      ) : (
        <FirstRunTourSlot plannerItemCount={plannerItemCount} />
      )}
      <div className="flex flex-col gap-3 @3xl/toolbar:flex-row @3xl/toolbar:items-start @3xl/toolbar:justify-between @3xl/toolbar:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h2
            id="planner-week-calendar-heading"
            className="font-heading w-full min-w-0 shrink-0 text-lg font-medium text-foreground @3xl/toolbar:w-auto"
          >
            Weekly schedule
          </h2>
          {meta ? (
            <div className="flex flex-wrap items-center gap-2">{meta}</div>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 @3xl/toolbar:shrink-0 @3xl/toolbar:justify-end">
          <div className="min-w-0">{exportSlot}</div>
          <div className="flex flex-wrap items-center gap-1">{actions}</div>
        </div>
      </div>
    </div>
  );
}
