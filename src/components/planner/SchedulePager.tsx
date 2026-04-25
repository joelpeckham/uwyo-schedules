"use client";

import { usePlanner } from "./PlannerContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function SchedulePager() {
  const {
    solutions,
    solutionIndex,
    setSolutionIndex,
    solutionsCapped,
    solutionsTimedOut,
    favoriteSolutionIndex,
    setFavoriteSolutionIndex,
    requireOpenSections,
    setRequireOpenSections,
    recalculateSolutions,
  } = usePlanner();

  const n = solutions.length;
  const pos = n === 0 ? 0 : solutionIndex + 1;
  const isFavorite =
    favoriteSolutionIndex != null && favoriteSolutionIndex === solutionIndex;

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
      aria-labelledby="schedule-pager-heading"
    >
      <h2
        id="schedule-pager-heading"
        className="font-heading text-lg font-medium text-foreground"
      >
        Valid schedules
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We combine your courses so nothing overlaps in time. Page through to
        preview each week.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="touch-manipulation"
            disabled={n === 0 || solutionIndex <= 0}
            onClick={() => setSolutionIndex(solutionIndex - 1)}
            aria-label="Previous schedule"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[10rem] text-center font-mono text-sm text-foreground">
            {n === 0 ? "No schedules" : `Option ${pos} of ${n}`}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="touch-manipulation"
            disabled={n === 0 || solutionIndex >= n - 1}
            onClick={() => setSolutionIndex(solutionIndex + 1)}
            aria-label="Next schedule"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            type="button"
            variant={isFavorite ? "secondary" : "ghost"}
            size="icon"
            className="touch-manipulation"
            disabled={n === 0}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite ? "Remove favorite schedule" : "Mark as favorite"
            }
            onClick={() =>
              setFavoriteSolutionIndex(isFavorite ? null : solutionIndex)
            }
          >
            <Star
              className={cn("size-4", isFavorite && "fill-primary text-primary")}
            />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="open-only"
            type="checkbox"
            className="size-4 rounded border-border accent-primary"
            checked={requireOpenSections}
            onChange={(e) => {
              const next = e.target.checked;
              setRequireOpenSections(next);
              void recalculateSolutions(next);
            }}
          />
          <Label htmlFor="open-only" className="text-sm text-foreground">
            Only sections with seats
          </Label>
        </div>
      </div>

      {solutionsCapped ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Result list was capped. Narrow preferences or remove a course to focus
          the search.
        </p>
      ) : null}
      {solutionsTimedOut ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Search stopped early because it was taking too long. Fewer schedules
          may be listed than exist.
        </p>
      ) : null}
    </section>
  );
}
