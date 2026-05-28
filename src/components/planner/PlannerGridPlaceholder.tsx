"use client";

import { useSyncExternalStore } from "react";

import { readBootstrapPlannerItemCount } from "@/lib/planner/planner-bootstrap";

import { WeekCalendarLoadingPlaceholder } from "./WeekCalendarLoadingPlaceholder";

type CourseManagerSkeletonProps = {
  courseRowCount: number;
};

function CourseManagerSkeleton({ courseRowCount }: CourseManagerSkeletonProps) {
  const rows = Math.max(0, courseRowCount);

  return (
    <section
      aria-hidden
      className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <div className="h-6 w-32 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted/70" />
        </div>
        <div className="h-6 w-28 rounded bg-muted/50" />
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1 sm:min-w-48">
          <div className="h-4 w-24 rounded bg-muted/60" />
          <div className="mt-1 h-11 rounded-md border border-border bg-muted/30" />
        </div>
        <div className="h-11 w-full rounded-md bg-muted/40 sm:w-24" />
      </div>
      <div className="mt-1 h-5" aria-hidden />
      {rows > 0 ? (
        <ul className="mt-6 space-y-2">
          {Array.from({ length: rows }, (_, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/15 p-2 sm:p-3"
            >
              <div className="size-8 shrink-0 rounded-md bg-muted/50" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-24 rounded bg-muted/70" />
                <div className="h-3 w-20 rounded bg-muted/40" />
              </div>
              <div className="size-8 shrink-0 rounded-md bg-muted/40" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 h-4 w-56 rounded bg-muted/50" />
      )}
    </section>
  );
}

function FiltersCardSkeleton() {
  return (
    <section
      aria-hidden
      className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="h-6 w-20 rounded bg-muted" />
      <div className="mt-2 h-4 w-full max-w-xs rounded bg-muted/60" />
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-24 rounded bg-muted/70" />
          <div className="h-6 w-11 rounded-full bg-muted/50" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-32 rounded bg-muted/70" />
          <div className="h-6 w-11 rounded-full bg-muted/50" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-36 rounded bg-muted/70" />
          <div className="h-6 w-11 rounded-full bg-muted/50" />
        </div>
      </div>
    </section>
  );
}

function PlannerCalendarColumnPlaceholder() {
  return (
    <div className="mt-6 flex min-w-0 flex-col gap-4 lg:mt-0">
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: "0fr" }}
        aria-hidden
      >
        <div className="min-h-0 overflow-hidden" />
      </div>
      <WeekCalendarLoadingPlaceholder />
    </div>
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
 * Course row count uses server snapshot 0 for SSR/hydration, then bootstrap dataset.
 */
export function PlannerGridPlaceholder() {
  const courseRowCount = useSyncExternalStore(
    subscribePlannerItemCount,
    getPlannerItemCountSnapshot,
    getPlannerItemCountServerSnapshot,
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div className="min-w-0 space-y-4">
        <CourseManagerSkeleton courseRowCount={courseRowCount} />
        <FiltersCardSkeleton />
      </div>
      <PlannerCalendarColumnPlaceholder />
    </div>
  );
}
