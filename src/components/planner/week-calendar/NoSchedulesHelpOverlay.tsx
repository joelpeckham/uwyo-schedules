"use client";

import { type ReactNode } from "react";

import { CalendarScrimOverlay } from "./CalendarScrimOverlay";

type Props = {
  show: boolean;
  children: ReactNode;
};

/** Centered, animated overlay when the planner has courses but no feasible schedule. */
export function NoSchedulesHelpOverlay({ show, children }: Props) {
  return (
    <CalendarScrimOverlay
      show={show}
      labelledBy="planner-no-schedules-heading"
    >
      {children}
    </CalendarScrimOverlay>
  );
}
