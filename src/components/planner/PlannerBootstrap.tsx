"use client";

import { applyPlannerBootstrap } from "@/lib/planner/planner-bootstrap";

type Props = {
  termCode: string;
};

/**
 * Sets `html[data-planner-items]` before planner children paint. Replaces the
 * inline blocking script removed for Next.js 16 / React 19 client navigations.
 */
export function PlannerBootstrap({ termCode }: Props) {
  if (typeof document !== "undefined") {
    applyPlannerBootstrap(termCode);
  }
  return null;
}
