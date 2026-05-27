"use client";

import { Ban, ChevronDown, CircleHelp, Copy, Minus, ZoomIn } from "lucide-react";

import { SolutionsPagerBar } from "@/components/planner/SolutionsPager";
import { WeekCalendarGrid } from "@/components/planner/week-calendar/WeekCalendarGrid";
import { WeekCalendarShell } from "@/components/planner/week-calendar/WeekCalendarShell";
import { WeekCalendarToolbar } from "@/components/planner/week-calendar/WeekCalendarToolbar";
import { LANDING_PREVIEW_HOUR_AXIS } from "@/components/planner/week-calendar/axis-constants";
import {
  initialPlannerHourRowPx,
  PLANNER_WEEK_VIEWPORT_HEIGHT,
  PLANNER_WEEKDAY_DAY_INDICES,
  PLANNER_WEEKDAY_GRID_MIN_WIDTH_REM,
} from "@/components/planner/week-calendar/constants";
import { Button } from "@/components/ui/button";
import {
  LANDING_PREVIEW_BLOCKS,
  LANDING_PREVIEW_CREDIT_HOURS,
  LANDING_PREVIEW_PLANNER_ITEM_COUNT,
  LANDING_PREVIEW_SOLUTION_TOTAL,
} from "@/lib/planner/landing-preview-blocks";
import { cn } from "@/lib/utils";

function StaticCreditHoursPill({ total }: { total: number }) {
  const isFullTime = total >= 12;
  const display = Number.isInteger(total) ? `${total}` : total.toFixed(1);
  const label = `${display} credit hour${total === 1 ? "" : "s"}`;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium",
        isFullTime
          ? "border-amber-500/40 bg-amber-100/70 text-amber-900"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
      title={label}
      aria-hidden
    >
      <span className="font-mono tabular-nums">{display}</span>
      <span>cr</span>
      {isFullTime ? <span className="ml-0.5">· full-time</span> : null}
    </span>
  );
}

export function LandingWeekCalendarPreview() {
  const hourCount = LANDING_PREVIEW_HOUR_AXIS.length;

  return (
    <div className="pointer-events-none">
      <WeekCalendarShell
        sectionId="landing-week-calendar-preview"
        isDragging={false}
        syncError={null}
        onClearSyncError={() => {}}
        scheduleFeasibilityError={null}
        onClearScheduleFeasibilityError={() => {}}
        swapError={null}
        onClearSwapError={() => {}}
        isRecalculatingSolutions={false}
        noSchedulesHelp={null}
        solutionsPager={
          <SolutionsPagerBar
            current={0}
            total={LANDING_PREVIEW_SOLUTION_TOTAL}
            canUndo={false}
            canRedo={false}
            disabled
          />
        }
        toolbar={
          <WeekCalendarToolbar
            tourSlot={null}
            plannerItemCount={LANDING_PREVIEW_PLANNER_ITEM_COUNT}
            meta={<StaticCreditHoursPill total={LANDING_PREVIEW_CREDIT_HOURS} />}
            exportSlot={
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-9 touch-manipulation"
                disabled
                tabIndex={-1}
              >
                <Copy className="mr-1.5 size-4" aria-hidden />
                <span>Copy / export</span>
                <ChevronDown className="ml-1.5 size-3.5 opacity-60" aria-hidden />
              </Button>
            }
            actions={
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 touch-manipulation"
                  disabled
                  tabIndex={-1}
                >
                  <Ban className="size-4" aria-hidden />
                  <span className="ml-1.5 hidden sm:inline">Mark busy time</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  className="touch-manipulation"
                  disabled
                  tabIndex={-1}
                  aria-label="Zoom week view out"
                >
                  <Minus className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  className="touch-manipulation"
                  disabled
                  tabIndex={-1}
                  aria-label="Zoom week view in"
                >
                  <ZoomIn className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="shrink-0 text-muted-foreground"
                  disabled
                  tabIndex={-1}
                  aria-label="How to use the weekly schedule"
                >
                  <CircleHelp className="size-5" aria-hidden />
                </Button>
              </>
            }
          />
        }
      >
        <WeekCalendarGrid
          blocks={LANDING_PREVIEW_BLOCKS}
          visibleDayIndices={PLANNER_WEEKDAY_DAY_INDICES}
          rowPx={initialPlannerHourRowPx(hourCount)}
          hourAxis={LANDING_PREVIEW_HOUR_AXIS}
          viewportStyle={{ height: PLANNER_WEEK_VIEWPORT_HEIGHT }}
          gridMinWidthRem={PLANNER_WEEKDAY_GRID_MIN_WIDTH_REM}
        />
      </WeekCalendarShell>
    </div>
  );
}
