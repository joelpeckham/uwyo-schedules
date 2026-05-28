"use client";

import type { ReactNode } from "react";

import { usePlannerData } from "./PlannerContext";
import { PlannerGridPlaceholder } from "./PlannerGridPlaceholder";

type Props = {
  children: ReactNode;
};

/** Defers real planner UI until localStorage restore completes (avoids empty-list flash). */
export function PlannerHydrationGate({ children }: Props) {
  const { isHydrating } = usePlannerData();

  if (isHydrating) {
    return <PlannerGridPlaceholder />;
  }

  return children;
}
