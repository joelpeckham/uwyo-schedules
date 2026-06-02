"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WeekCalendarAlertSlot } from "./WeekCalendarAlertSlot";
import { NoSchedulesHelpOverlay } from "./NoSchedulesHelpOverlay";
import { WeekCalendarBuildingOverlay } from "./WeekCalendarBuildingOverlay";

type WeekCalendarShellProps = {
  sectionId?: string;
  isDragging: boolean;
  isRecalculatingSolutions: boolean;
  alertTrailing?: ReactNode;
  toolbar: ReactNode;
  noSchedulesHelp: ReactNode | null;
  children: ReactNode;
};

/** Alerts, toolbar, and help — isolated from the memoized grid subtree. */
export function WeekCalendarShell({
  sectionId = "planner-week-calendar",
  isDragging,
  isRecalculatingSolutions,
  alertTrailing,
  toolbar,
  noSchedulesHelp,
  children,
}: WeekCalendarShellProps) {
  return (
    <section
      id={sectionId}
      className={cn(
        "scroll-mt-20 min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        isDragging && "select-none",
      )}
      aria-labelledby="planner-week-calendar-heading"
    >
      <p className="sr-only">
        Week view shows Monday through Friday by default. Saturday and Sunday
        appear when a course or busy time uses those days.
      </p>
      <WeekCalendarAlertSlot trailing={alertTrailing} />
      {toolbar}
      <div className="relative">
        {children}
        <WeekCalendarBuildingOverlay show={isRecalculatingSolutions} />
        <NoSchedulesHelpOverlay show={noSchedulesHelp != null}>
          {noSchedulesHelp}
        </NoSchedulesHelpOverlay>
      </div>
    </section>
  );
}
