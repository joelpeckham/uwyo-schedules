"use client";

import { collectDisplayCrnsForItems } from "@/lib/planner/client/derive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Star,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { usePlanner } from "./PlannerContext";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

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
    plannerItems,
    blackouts,
    setBlackouts,
    isRecalculatingSolutions,
    syncError,
    clearSyncError,
    effectivePlannerItems,
    catalog,
  } = usePlanner();

  const n = solutions.length;
  const pos = n === 0 ? 0 : solutionIndex + 1;
  const isFavorite =
    favoriteSolutionIndex != null && favoriteSolutionIndex === solutionIndex;

  const pagerRef = useRef<HTMLElement>(null);
  const [jumpInput, setJumpInput] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "ok" | "err">("idle");

  useEffect(() => {
    if (n === 0) {
      setJumpInput("");
      return;
    }
    setJumpInput(String(pos));
  }, [n, pos]);

  const applyJump = useCallback(() => {
    if (n === 0) return;
    const parsed = Number.parseInt(jumpInput.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > n) return;
    setSolutionIndex(parsed - 1);
  }, [jumpInput, n, setSolutionIndex]);

  const onPagerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (n === 0) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      // k / ArrowLeft = previous; j / ArrowRight = next (matches common j/k list paging).
      if (e.key === "ArrowLeft" || e.key === "k" || e.key === "K") {
        if (solutionIndex > 0) {
          e.preventDefault();
          setSolutionIndex(solutionIndex - 1);
        }
      } else if (e.key === "ArrowRight" || e.key === "j" || e.key === "J") {
        if (solutionIndex < n - 1) {
          e.preventDefault();
          setSolutionIndex(solutionIndex + 1);
        }
      }
    },
    [n, setSolutionIndex, solutionIndex],
  );

  const crns = collectDisplayCrnsForItems(effectivePlannerItems, catalog);

  const copyCrns = useCallback(async () => {
    if (crns.length === 0) return;
    try {
      await navigator.clipboard.writeText(crns.join("\n"));
      setCopyStatus("ok");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("err");
      window.setTimeout(() => setCopyStatus("idle"), 2500);
    }
  }, [crns]);

  const showNoSchedulesHelp = n === 0 && plannerItems.length > 0;
  const busyCount = blackouts.items.length;

  return (
    <section
      ref={pagerRef}
      id="planner-schedule-pager"
      tabIndex={0}
      onKeyDown={onPagerKeyDown}
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
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
        preview each week. When this panel is focused, use arrow keys or K /
        J to move between options.
      </p>

      {syncError ? (
        <div
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {syncError}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => clearSyncError()}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {isRecalculatingSolutions ? (
        <p
          className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          Updating schedules…
        </p>
      ) : null}

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
            {n === 0
              ? plannerItems.length === 0
                ? "Add courses first"
                : "No schedules"
              : `Option ${pos} of ${n}`}
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
          {favoriteSolutionIndex != null &&
          n > 0 &&
          favoriteSolutionIndex !== solutionIndex ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto min-h-0 px-1 py-0 text-sm"
              onClick={() => setSolutionIndex(favoriteSolutionIndex)}
            >
              Jump to favorite
            </Button>
          ) : null}
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

      {n > 1 ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="schedule-jump" className="text-xs text-muted-foreground">
              Go to option #
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="schedule-jump"
                inputMode="numeric"
                className="h-9 w-20 font-mono text-sm"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyJump();
                  }
                }}
                aria-label="Schedule option number"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="touch-manipulation"
                onClick={applyJump}
              >
                Go
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="touch-manipulation"
          disabled={n === 0 || crns.length === 0}
          onClick={() => void copyCrns()}
        >
          <Copy className="mr-1.5 size-4 shrink-0" aria-hidden />
          Copy CRNs
        </Button>
        {copyStatus === "ok" ? (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Copied to clipboard
          </span>
        ) : null}
        {copyStatus === "err" ? (
          <span className="text-xs text-destructive" aria-live="polite">
            Could not copy — try again or copy manually
          </span>
        ) : null}
      </div>

      {showNoSchedulesHelp ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/25 px-3 py-3 text-sm">
          <p className="font-medium text-foreground">Nothing fits yet — try this</p>
          <p className="mt-1 text-muted-foreground">
            One or more of these usually unlocks valid schedules:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-2 text-foreground">
            {requireOpenSections ? (
              <li>
                <button
                  type="button"
                  className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                  onClick={() => {
                    setRequireOpenSections(false);
                    void recalculateSolutions(false);
                    document.getElementById("open-only")?.focus();
                  }}
                >
                  Turn off “only sections with seats”
                </button>{" "}
                <span className="text-muted-foreground">
                  (then check again if you need open seats only).
                </span>
              </li>
            ) : (
              <li>
                <button
                  type="button"
                  className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                  onClick={() => document.getElementById("open-only")?.focus()}
                >
                  Try “only sections with seats”
                </button>{" "}
                <span className="text-muted-foreground">
                  — sometimes the opposite helps.
                </span>
              </li>
            )}
            {busyCount > 0 ? (
              <li>
                <button
                  type="button"
                  className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                  onClick={() => scrollToId("planner-week-calendar-toolbar")}
                >
                  Edit or remove busy times
                </button>{" "}
                <span className="text-muted-foreground">
                  ({busyCount} on your calendar)
                </span>
                {" · "}
                <button
                  type="button"
                  className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                  onClick={() => setBlackouts({ v: 1, items: [] })}
                >
                  Clear all busy times
                </button>
              </li>
            ) : (
              <li>
                <button
                  type="button"
                  className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                  onClick={() => scrollToId("planner-week-calendar-toolbar")}
                >
                  Add busy times
                </button>{" "}
                <span className="text-muted-foreground">
                  only if something should stay free.
                </span>
              </li>
            )}
            <li>
              <button
                type="button"
                className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                onClick={() => scrollToId("planner-courses")}
              >
                Relax instructor choices
              </button>
              <span className="text-muted-foreground">
                {" "}
                (pick “Any” or expand Advanced for labs/discussions).
              </span>
            </li>
            <li>
              <button
                type="button"
                className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                onClick={() => scrollToId("planner-courses")}
              >
                Remove a course
              </button>
              <span className="text-muted-foreground">
                {" "}
                if you added more than you need this term.
              </span>
            </li>
          </ul>
          {(solutionsCapped || solutionsTimedOut) && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              {solutionsCapped
                ? "We also stopped after listing many options — tightening preferences or removing a course can surface a workable schedule faster."
                : null}
              {solutionsCapped && solutionsTimedOut ? " " : null}
              {solutionsTimedOut
                ? "Search stopped early for speed — fewer combinations may be listed than actually exist."
                : null}
            </p>
          )}
        </div>
      ) : null}

      {solutionsCapped && n > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Result list was capped. Narrow preferences or remove a course to focus
          the search.
        </p>
      ) : null}
      {solutionsTimedOut && n > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Search stopped early because it was taking too long. Fewer schedules
          may be listed than exist.
        </p>
      ) : null}
    </section>
  );
}
