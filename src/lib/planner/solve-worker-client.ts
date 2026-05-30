import type { PlannerCatalogJson } from "./client/catalog-types";
import {
  computeInfeasibilityHints,
  type InfeasibilityHint,
} from "./infeasibility-hints";
import type { PlannerBlackoutsDocV1 } from "./blackouts";
import type { PlannerItemRow } from "./data";
import type { PlannerScheduleFilters } from "./schedule-filters";
import type { ResolvedPlannerSelection } from "./resolve-display-crns-shared";
import {
  solveSchedulesFromPacks,
  WORKER_SOLVE_TIMEOUT_MS,
  type CourseSolvePack,
  type ScheduleSolution,
  type TimeInterval,
} from "./solve-schedules-core";
import type {
  SolveWorkerRequest,
  SolveWorkerResponse,
} from "./solve.worker";

type SolveWithHintsResult = {
  solutions: ScheduleSolution[];
  capped: boolean;
  timedOut: boolean;
  itemOrder: number[];
  hints: InfeasibilityHint[];
};

type RequestSolveParams = {
  items: PlannerItemRow[];
  packs: Record<string, CourseSolvePack>;
  filters: Pick<
    PlannerScheduleFilters,
    "requireOpenSections" | "excludeTba" | "excludeOnlineAsync"
  >;
  blackoutIntervals: TimeInterval[];
  previousSelections?: Record<number, ResolvedPlannerSelection> | null;
  maxSolutions?: number;
  timeoutMs?: number;
  catalog?: PlannerCatalogJson | null;
  blackouts?: PlannerBlackoutsDocV1;
};

let nextRequestId = 1;
let worker: Worker | null = null;
let workerFailed = false;

const pending = new Map<
  number,
  {
    resolve: (r: SolveWithHintsResult) => void;
    reject: (err: Error) => void;
  }
>();

function canUseWorker(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof import.meta.url === "string" &&
    !workerFailed
  );
}

function getWorker(): Worker | null {
  if (!canUseWorker()) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./solve.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (ev: MessageEvent<SolveWorkerResponse>) => {
      const msg = ev.data;
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      entry.resolve({
        solutions: msg.solutions,
        capped: msg.capped,
        timedOut: msg.timedOut,
        itemOrder: msg.itemOrder,
        hints: msg.hints,
      });
    };
    worker.onerror = () => {
      workerFailed = true;
      worker = null;
      for (const [, entry] of pending) {
        entry.reject(new Error("solve worker failed"));
      }
      pending.clear();
    };
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

function solveSynchronously(params: RequestSolveParams): SolveWithHintsResult {
  const timeoutMs = params.timeoutMs ?? WORKER_SOLVE_TIMEOUT_MS;
  const result = solveSchedulesFromPacks(params.items, params.packs, {
    requireOpenSections: params.filters.requireOpenSections,
    excludeTba: params.filters.excludeTba,
    excludeOnlineAsync: params.filters.excludeOnlineAsync,
    blackoutIntervals: params.blackoutIntervals,
    previousSelections: params.previousSelections,
    maxSolutions: params.maxSolutions ?? 1,
    timeoutMs,
  });

  let hints: InfeasibilityHint[] = [];
  if (result.solutions.length === 0 && params.items.length > 0) {
    const blackouts = params.blackouts ?? { v: 1 as const, items: [] };
    hints = computeInfeasibilityHints({
      items: params.items,
      packs: params.packs,
      blackouts,
      requireOpenSections: params.filters.requireOpenSections,
      excludeTba: params.filters.excludeTba,
      excludeOnlineAsync: params.filters.excludeOnlineAsync,
      catalog: params.catalog ?? null,
      baseAlreadyInfeasible: true,
    });
  }

  return {
    solutions: result.solutions,
    capped: result.capped,
    timedOut: result.timedOut,
    itemOrder: result.itemOrder,
    hints,
  };
}

/**
 * Run schedule solve (+ infeasibility hints when empty) off the main thread when
 * possible. Stale requests are dropped when a newer `requestId` is issued.
 */
export function requestSolve(
  params: RequestSolveParams,
  options?: { requestId?: number },
): Promise<SolveWithHintsResult> {
  const id = options?.requestId ?? nextRequestId++;
  const w = getWorker();

  if (!w) {
    return Promise.resolve(solveSynchronously(params));
  }

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const msg: SolveWorkerRequest = {
      id,
      items: params.items,
      packs: params.packs,
      filters: params.filters,
      blackoutIntervals: params.blackoutIntervals,
      previousSelections: params.previousSelections,
      maxSolutions: params.maxSolutions,
      timeoutMs: params.timeoutMs,
      catalog: params.catalog,
      blackouts: params.blackouts,
      baseAlreadyInfeasible: true,
    };
    w.postMessage(msg);
  });
}

/** Cancel an in-flight worker request (response will be ignored). */
export function cancelSolveRequest(requestId: number): void {
  pending.delete(requestId);
}
