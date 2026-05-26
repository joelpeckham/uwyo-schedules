"use client";

import { memo } from "react";
import type { SwapGhostMeeting } from "@/lib/planner/data";
import { cn } from "@/lib/utils";

type Props = {
  ghosts: readonly SwapGhostMeeting[];
  snapped: SwapGhostMeeting | null;
  startMin: number;
  totalMin: number;
  gridHeightPx: number;
};

function WeekCalendarDayGhostsInner({
  ghosts,
  snapped,
  startMin,
  totalMin,
  gridHeightPx,
}: Props) {
  if (ghosts.length === 0) return null;

  return (
    <>
      {ghosts.map((g) => {
        const topPx =
          ((g.startMinutes - startMin) / totalMin) * gridHeightPx;
        const rawH =
          ((g.endMinutes - g.startMinutes) / totalMin) * gridHeightPx;
        const heightPx = Math.max(8, rawH);
        const isSnap =
          !!snapped &&
          snapped.crn === g.crn &&
          snapped.meetingId === g.meetingId &&
          snapped.dayIndex === g.dayIndex &&
          snapped.startMinutes === g.startMinutes &&
          snapped.endMinutes === g.endMinutes;
        return (
          <div
            key={`ghost-${g.crn}-${g.meetingId}-${g.dayIndex}-${g.startMinutes}`}
            className={cn(
              "pointer-events-none absolute left-0.5 right-0.5 z-[30] rounded-md border border-dashed border-muted-foreground/50 bg-muted/25",
              isSnap &&
                "border-primary/70 bg-primary/10 ring-1 ring-primary/40",
            )}
            style={{ top: topPx, height: heightPx }}
            aria-hidden
          />
        );
      })}
    </>
  );
}

export const WeekCalendarDayGhosts = memo(WeekCalendarDayGhostsInner);
