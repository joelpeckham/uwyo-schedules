"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";
import { usePlannerSolve } from "./PlannerContext";

// Loaded only when the user opens the compare modal — its inner calendar
// previews mean the bundle isn't trivial.
const SchedulesCompare = dynamic(
  () => import("./SchedulesCompare").then((m) => m.SchedulesCompare),
  { ssr: false },
);

/**
 * Strip above the calendar that lets the user page through alternate
 * conflict-free schedules and keep favorites for later comparison.
 */
export function SolutionsPager() {
  const {
    solutions,
    solutionsCapped,
    solutionsTimedOut,
    currentSolutionIndex,
    setCurrentSolutionIndex,
    isCurrentSolutionKept,
    toggleCurrentSolutionKept,
    keptSolutions,
    keptSolutionIndices,
    isRecalculatingSolutions,
    hasAttemptedSolve,
  } = usePlannerSolve();

  const total = solutions.length;
  const [compareOpen, setCompareOpen] = useState(false);

  const sortedKeptIndices = useMemo(
    () => [...keptSolutionIndices].sort((a, b) => a - b),
    [keptSolutionIndices],
  );

  const canCompare = sortedKeptIndices.length >= 2;
  const compareDialogOpen = compareOpen && canCompare;

  const onlyOne = total <= 1;
  const human = total > 0 ? currentSolutionIndex + 1 : 0;

  return (
    <div
      className="flex min-h-20 flex-col justify-center gap-2 border-b border-border bg-muted/15 px-3 py-2 sm:min-h-11 sm:flex-row sm:items-center sm:justify-between sm:px-4"
      aria-label="Schedule options"
    >
      {total === 0 ? (
        <p
          className="text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {isRecalculatingSolutions || !hasAttemptedSolve
            ? "Building first schedule…"
            : "Schedule pager"}
        </p>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {human} / {total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Previous schedule"
                disabled={onlyOne || currentSolutionIndex <= 0}
                onClick={() => {
                  setCurrentSolutionIndex(currentSolutionIndex - 1, "prev");
                }}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Next schedule"
                disabled={onlyOne || currentSolutionIndex >= total - 1}
                onClick={() => {
                  setCurrentSolutionIndex(currentSolutionIndex + 1, "next");
                }}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
            {solutionsCapped || solutionsTimedOut ? (
              <span className="text-[11px] leading-tight text-muted-foreground">
                More may exist — pin a section or relax filters to narrow down.
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant={isCurrentSolutionKept ? "default" : "outline"}
              size="sm"
              className="h-8 touch-manipulation"
              aria-pressed={isCurrentSolutionKept}
              onClick={() => toggleCurrentSolutionKept()}
            >
              <Star
                className={cn(
                  "mr-1 size-3.5",
                  isCurrentSolutionKept ? "fill-current" : "",
                )}
                aria-hidden
              />
              {isCurrentSolutionKept ? "Kept" : "Keep"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 touch-manipulation"
              disabled={!canCompare}
              onClick={() => {
                track("planner_compare_opened", {
                  kept: sortedKeptIndices.length,
                });
                setCompareOpen(true);
              }}
              title={
                !canCompare
                  ? "Keep at least two schedules to compare"
                  : undefined
              }
            >
              Compare ({sortedKeptIndices.length})
            </Button>
          </div>
        </>
      )}
      {compareOpen ? (
        <SchedulesCompare
          open={compareDialogOpen}
          onOpenChange={setCompareOpen}
          keptIndices={sortedKeptIndices}
          keptKeys={keptSolutions.keys}
        />
      ) : null}
    </div>
  );
}
