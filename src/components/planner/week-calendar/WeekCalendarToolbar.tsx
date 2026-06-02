"use client";

import type { ReactNode } from "react";

import { FirstRunTourSlot } from "./FirstRunTourSlot";

type WeekCalendarToolbarProps = {
  plannerItemCount: number;
  /** When `null`, skip the first-run tour slot (e.g. landing preview). */
  tourSlot?: ReactNode | null;
  leading: ReactNode;
  trailing: ReactNode;
};

/** Week calendar toolbar: first-run tour slot + leading/trailing action controls. */
export function WeekCalendarToolbar({
  plannerItemCount,
  tourSlot,
  leading,
  trailing,
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
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">{leading}</div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {trailing}
        </div>
      </div>
    </div>
  );
}
