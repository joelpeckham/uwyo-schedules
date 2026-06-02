"use client";

import { Loader2 } from "lucide-react";

import { CalendarScrimOverlay } from "./CalendarScrimOverlay";

type Props = {
  show: boolean;
};

export function WeekCalendarBuildingOverlay({ show }: Props) {
  return (
    <CalendarScrimOverlay show={show}>
      <div
        className="flex flex-col items-center justify-center gap-3 py-8"
        aria-live="polite"
      >
        <Loader2
          className="size-8 shrink-0 animate-spin text-muted-foreground"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground">Building this week&hellip;</p>
      </div>
    </CalendarScrimOverlay>
  );
}
