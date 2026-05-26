"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WeekCalendarAlertSlot } from "./WeekCalendarAlertSlot";
import { SolutionsPager } from "../SolutionsPager";

type WeekCalendarShellProps = {
  isDragging: boolean;
  syncError: string | null;
  onClearSyncError: () => void;
  scheduleFeasibilityError: string | null;
  onClearScheduleFeasibilityError: () => void;
  swapError: string | null;
  onClearSwapError: () => void;
  isRecalculatingSolutions: boolean;
  toolbar: ReactNode;
  noSchedulesHelp: ReactNode | null;
  children: ReactNode;
};

/** Alerts, toolbar, pager, and help — isolated from the memoized grid subtree. */
export function WeekCalendarShell({
  isDragging,
  syncError,
  onClearSyncError,
  scheduleFeasibilityError,
  onClearScheduleFeasibilityError,
  swapError,
  onClearSwapError,
  isRecalculatingSolutions,
  toolbar,
  noSchedulesHelp,
  children,
}: WeekCalendarShellProps) {
  return (
    <section
      id="planner-week-calendar"
      className={cn(
        "scroll-mt-20 min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        isDragging && "select-none",
      )}
      aria-labelledby="planner-week-calendar-heading"
    >
      <p className="sr-only">
        Week view shows Monday through Sunday. Empty weekend columns are shown
        faded until a course or busy time uses that day.
      </p>
      <WeekCalendarAlertSlot
        syncError={syncError}
        onClearSyncError={onClearSyncError}
        scheduleFeasibilityError={scheduleFeasibilityError}
        onClearScheduleFeasibilityError={onClearScheduleFeasibilityError}
        swapError={swapError}
        onClearSwapError={onClearSwapError}
        isRecalculatingSolutions={isRecalculatingSolutions}
      />
      {toolbar}
      {noSchedulesHelp}
      <SolutionsPager />
      {children}
    </section>
  );
}
