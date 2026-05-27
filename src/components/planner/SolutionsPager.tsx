"use client";

import { ChevronLeft, ChevronRight, Redo2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlannerHistory, usePlannerSolve } from "./PlannerContext";
import { usePlannerUndoRedoShortcuts } from "./usePlannerUndoRedoShortcuts";

type SolutionsPagerBarProps = {
  current: number;
  total: number;
  canUndo?: boolean;
  canRedo?: boolean;
  disabled?: boolean;
  solutionsCapped?: boolean;
  solutionsTimedOut?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  emptyStatus?: string;
};

/**
 * Presentational schedule pager strip (shared by live planner and landing preview).
 */
export function SolutionsPagerBar({
  current,
  total,
  canUndo = false,
  canRedo = false,
  disabled = false,
  solutionsCapped = false,
  solutionsTimedOut = false,
  onPrevious,
  onNext,
  onUndo,
  onRedo,
  emptyStatus,
}: SolutionsPagerBarProps) {
  const onlyOne = total <= 1;
  const human = total > 0 ? current + 1 : 0;

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
              variant="outline"
              size="sm"
              className="h-8 touch-manipulation"
              aria-label="Undo"
              title="Undo (⌘Z)"
              disabled={disabled || !canUndo}
              onClick={onUndo}
            >
              <Undo2 className={cn("mr-1 size-3.5")} aria-hidden />
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 touch-manipulation"
              aria-label="Redo"
              title="Redo (⇧⌘Z)"
              disabled={disabled || !canRedo}
              onClick={onRedo}
            >
              <Redo2 className={cn("mr-1 size-3.5")} aria-hidden />
              Redo
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Strip above the calendar that lets the user page through alternate
 * conflict-free schedules and undo or redo recent edits.
 */
export function SolutionsPager() {
  const {
    solutions,
    solutionsCapped,
    solutionsTimedOut,
    currentSolutionIndex,
    setCurrentSolutionIndex,
    isRecalculatingSolutions,
    hasAttemptedSolve,
  } = usePlannerSolve();
  const { canUndo, canRedo, undo, redo } = usePlannerHistory();

  usePlannerUndoRedoShortcuts({ undo, redo, canUndo, canRedo });

  const total = solutions.length;

  return (
    <SolutionsPagerBar
      current={currentSolutionIndex}
      total={total}
      canUndo={canUndo}
      canRedo={canRedo}
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
      onUndo={undo}
      onRedo={redo}
    />
  );
}
