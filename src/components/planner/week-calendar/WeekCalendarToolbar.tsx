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
 * Week calendar header: two rows by default, single row at xl+ when the
 * planner grid column is wide enough for title + actions side by side.
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
      className="border-b border-border p-3 sm:p-4"
      id="planner-week-calendar-toolbar"
    >
      {tourSlot !== undefined ? (
        tourSlot
      ) : (
        <FirstRunTourSlot plannerItemCount={plannerItemCount} />
      )}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between xl:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h2
            id="planner-week-calendar-heading"
            className="font-heading w-full min-w-0 shrink-0 text-lg font-medium text-foreground sm:w-auto"
          >
            Weekly schedule
          </h2>
          {meta ? (
            <div className="flex flex-wrap items-center gap-2">{meta}</div>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:shrink-0 xl:justify-end xl:gap-3">
          <div className="min-w-0">{exportSlot}</div>
          <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
            {actions}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Copy / export gives you the week as CRNs, an .ics file, or a print
        view. Use the CRNs to register in WyoWeb.
      </p>
    </div>
  );
}
