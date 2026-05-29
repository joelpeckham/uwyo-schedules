"use client";

import { useLayoutEffect } from "react";

import { applyPlannerBootstrap } from "@/lib/planner/planner-bootstrap";

type Props = {
  termCode: string;
};

/**
 * Sets `html[data-planner-items]` before planner children paint. Replaces the
 * inline blocking script removed for Next.js 16 / React 19 client navigations.
 */
export function PlannerBootstrap({ termCode }: Props) {
  useLayoutEffect(() => {
    applyPlannerBootstrap(termCode);
  }, [termCode]);
  return null;
}
