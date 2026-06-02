"use client";

import { useSyncExternalStore } from "react";

import { readBootstrapPlannerItemCount } from "@/lib/planner/planner-bootstrap";

import { WeekCalendarLoadingPlaceholder } from "./WeekCalendarLoadingPlaceholder";

function CourseCarouselSkeleton({ courseRowCount }: { courseRowCount: number }) {
  const cards = Math.max(1, Math.min(courseRowCount, 4));

  return (
    <section
      aria-hidden
      className="rounded-xl border border-border bg-card text-card-foreground shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <div className="space-y-1.5">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted/70" />
        </div>
        <div className="size-4 rounded bg-muted/50" />
      </div>
      <div className="flex gap-2 overflow-hidden px-3 pb-3 sm:px-4">
        {Array.from({ length: cards }, (_, i) => (
          <div
            key={i}
            className="h-18 w-52 shrink-0 rounded-lg border border-border bg-muted/15 p-2 sm:w-60"
          >
            <div className="flex gap-1.5">
              <div className="size-8 rounded-md bg-muted/50" />
              <div className="flex-1 space-y-1">
                <div className="h-3.5 w-full rounded bg-muted/60" />
                <div className="h-3 w-16 rounded bg-muted/40" />
              </div>
            </div>
            <div className="mt-2 h-3 w-16 rounded bg-muted/40" />
          </div>
        ))}
      </div>
    </section>
  );
}

function subscribePlannerItemCount() {
  return () => {};
}

function getPlannerItemCountSnapshot(): number {
  return readBootstrapPlannerItemCount();
}

function getPlannerItemCountServerSnapshot(): number {
  return 0;
}

/**
 * In-place grid placeholder (Suspense fallback + post-Suspense hydration gate).
 */
export function PlannerGridPlaceholder() {
  const courseRowCount = useSyncExternalStore(
    subscribePlannerItemCount,
    getPlannerItemCountSnapshot,
    getPlannerItemCountServerSnapshot,
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CourseCarouselSkeleton courseRowCount={courseRowCount} />
      <WeekCalendarLoadingPlaceholder />
    </div>
  );
}
