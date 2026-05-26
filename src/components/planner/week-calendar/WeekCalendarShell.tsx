"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WeekCalendarAlertSlot } from "./WeekCalendarAlertSlot";
import { SolutionsPager } from "../SolutionsPager";

type WeekCalendarShellProps = {
  sectionId?: string;
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
  solutionsPager?: ReactNode;
  children: ReactNode;
};

/** Alerts, toolbar, pager, and help — isolated from the memoized grid subtree. */
export function WeekCalendarShell({
  sectionId = "planner-week-calendar",
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
  solutionsPager,
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
      {solutionsPager ?? <SolutionsPager />}
      {children}
    </section>
  );
}
