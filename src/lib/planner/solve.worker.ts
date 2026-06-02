/// <reference lib="webworker" />

import type { PlannerCatalogJson } from "./client/catalog-types";
import type { PlannerBlackoutsDocV1 } from "./blackouts";
import type { PlannerItemRow } from "./data";
import {
  computeInfeasibilityHints,
  type InfeasibilityHint,
} from "./infeasibility-hints";
import type { ResolvedPlannerSelection } from "./resolve-display-crns-shared";
import {
  solveSchedulesFromPacks,
  WORKER_SOLVE_TIMEOUT_MS,
  type CourseSolvePack,
  type ScheduleSolution,
  type TimeInterval,
} from "./solve-schedules-core";

export type SolveWorkerRequest = {
  id: number;
  items: PlannerItemRow[];
  packs: Record<string, CourseSolvePack>;
  blackoutIntervals: TimeInterval[];
  previousSelections?: Record<number, ResolvedPlannerSelection> | null;
  maxSolutions?: number;
  timeoutMs?: number;
  /** When solve is infeasible, optional catalog for richer hints. */
  catalog?: PlannerCatalogJson | null;
  blackouts?: PlannerBlackoutsDocV1;
  baseAlreadyInfeasible?: boolean;
};

export type SolveWorkerResponse = {
  id: number;
  solutions: ScheduleSolution[];
  capped: boolean;
  timedOut: boolean;
  itemOrder: number[];
  hints: InfeasibilityHint[];
};

self.onmessage = (ev: MessageEvent<SolveWorkerRequest>) => {
  const msg = ev.data;
  const timeoutMs = msg.timeoutMs ?? WORKER_SOLVE_TIMEOUT_MS;

  const result = solveSchedulesFromPacks(msg.items, msg.packs, {
    blackoutIntervals: msg.blackoutIntervals,
    previousSelections: msg.previousSelections,
    maxSolutions: msg.maxSolutions ?? 1,
    timeoutMs,
  });

  let hints: InfeasibilityHint[] = [];
  if (result.solutions.length === 0 && msg.items.length > 0) {
    const blackouts = msg.blackouts ?? { v: 1 as const, items: [] };
    hints = computeInfeasibilityHints({
      items: msg.items,
      packs: msg.packs,
      blackouts,
      catalog: msg.catalog ?? null,
      baseAlreadyInfeasible: msg.baseAlreadyInfeasible ?? true,
    });
  }

  const response: SolveWorkerResponse = {
    id: msg.id,
    solutions: result.solutions,
    capped: result.capped,
    timedOut: result.timedOut,
    itemOrder: result.itemOrder,
    hints,
  };
  self.postMessage(response);
};
