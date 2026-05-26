import { cn } from "@/lib/utils";
import {
  initialPlannerHourRowPx,
  PLANNER_GRID_DAY_INDICES,
  PLANNER_GRID_MIN_WIDTH_REM,
  PLANNER_WEEK_VIEWPORT_HEIGHT,
} from "./constants";
import { CALENDAR_HOUR_AXIS } from "./axis-constants";
import { DAY_LABELS } from "./axis-constants";

/**
 * Inert week grid matching live calendar geometry (7 columns, hour axis).
 * Used by route skeleton and dynamic-import placeholder to minimize CLS.
 */
export function WeekCalendarGridSkeleton() {
  const rowPx = initialPlannerHourRowPx();
  const gridHeightPx = CALENDAR_HOUR_AXIS.length * rowPx;

  return (
    <div
      className="overflow-x-auto"
      style={{ minWidth: `max(100%, ${PLANNER_GRID_MIN_WIDTH_REM}rem)` }}
      aria-hidden
    >
      <div
        className="flex shrink-0 border-b border-border bg-muted/30"
        style={{ minWidth: `max(100%, ${PLANNER_GRID_MIN_WIDTH_REM}rem)` }}
      >
        <div className="w-14 shrink-0" />
        {PLANNER_GRID_DAY_INDICES.map((dayIndex) => (
          <div
            key={dayIndex}
            className={cn(
              "min-w-[4.5rem] flex-1 border-l border-border py-2 text-center font-mono text-xs font-medium text-muted-foreground",
              dayIndex >= 5 && "opacity-40",
            )}
          >
            {DAY_LABELS[dayIndex]}
          </div>
        ))}
      </div>
      <div
        className="relative overflow-hidden bg-muted/10"
        style={{ height: PLANNER_WEEK_VIEWPORT_HEIGHT }}
      >
        <div className="flex" style={{ minWidth: `max(100%, ${PLANNER_GRID_MIN_WIDTH_REM}rem)` }}>
          <div className="flex w-14 shrink-0 flex-col border-r border-border bg-muted/20">
            {CALENDAR_HOUR_AXIS.map((h) => (
              <div
                key={h}
                className="border-b border-border/50 bg-muted/20"
                style={{ height: rowPx, minHeight: rowPx }}
              />
            ))}
          </div>
          <div className="flex min-w-0 flex-1">
            {PLANNER_GRID_DAY_INDICES.map((dayIndex) => (
              <div
                key={dayIndex}
                className={cn(
                  "relative min-w-[4.5rem] flex-1 border-l border-border bg-muted/[0.07]",
                  dayIndex >= 5 && "opacity-40",
                )}
                style={{ height: gridHeightPx, minHeight: gridHeightPx }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
