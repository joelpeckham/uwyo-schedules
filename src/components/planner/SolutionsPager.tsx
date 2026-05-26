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

type SolutionsPagerBarProps = {
  current: number;
  total: number;
  isKept: boolean;
  keptCount: number;
  disabled?: boolean;
  solutionsCapped?: boolean;
  solutionsTimedOut?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onToggleKeep?: () => void;
  onCompare?: () => void;
  emptyStatus?: string;
};

/**
 * Presentational schedule pager strip (shared by live planner and landing preview).
 */
export function SolutionsPagerBar({
  current,
  total,
  isKept,
  keptCount,
  disabled = false,
  solutionsCapped = false,
  solutionsTimedOut = false,
  onPrevious,
  onNext,
  onToggleKeep,
  onCompare,
  emptyStatus,
}: SolutionsPagerBarProps) {
  const onlyOne = total <= 1;
  const human = total > 0 ? current + 1 : 0;
  const canCompare = keptCount >= 2;

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
          {emptyStatus ?? "Schedule pager"}
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
                disabled={disabled || onlyOne || current <= 0}
                onClick={onPrevious}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Next schedule"
                disabled={disabled || onlyOne || current >= total - 1}
                onClick={onNext}
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
              variant={isKept ? "default" : "outline"}
              size="sm"
              className="h-8 touch-manipulation"
              aria-pressed={isKept}
              disabled={disabled}
              onClick={onToggleKeep}
            >
              <Star
                className={cn(
                  "mr-1 size-3.5",
                  isKept ? "fill-current" : "",
                )}
                aria-hidden
              />
              {isKept ? "Kept" : "Keep"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 touch-manipulation"
              disabled={disabled || !canCompare}
              onClick={onCompare}
              title={
                !canCompare
                  ? "Keep at least two schedules to compare"
                  : undefined
              }
            >
              Compare ({keptCount})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

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

  return (
    <>
      <SolutionsPagerBar
        current={currentSolutionIndex}
        total={total}
        isKept={isCurrentSolutionKept}
        keptCount={sortedKeptIndices.length}
        solutionsCapped={solutionsCapped}
        solutionsTimedOut={solutionsTimedOut}
        emptyStatus={
          isRecalculatingSolutions || !hasAttemptedSolve
            ? "Building first schedule…"
            : "Schedule pager"
        }
        onPrevious={() => {
          setCurrentSolutionIndex(currentSolutionIndex - 1, "prev");
        }}
        onNext={() => {
          setCurrentSolutionIndex(currentSolutionIndex + 1, "next");
        }}
        onToggleKeep={() => toggleCurrentSolutionKept()}
        onCompare={() => {
          track("planner_compare_opened", {
            kept: sortedKeptIndices.length,
          });
          setCompareOpen(true);
        }}
      />
      {compareOpen ? (
        <SchedulesCompare
          open={compareDialogOpen}
          onOpenChange={setCompareOpen}
          keptIndices={sortedKeptIndices}
          keptKeys={keptSolutions.keys}
        />
      ) : null}
    </>
  );
}
