import type { PlannerBlackoutsDocV1 } from "@/lib/planner/blackouts";
import type { PlannerItemRow } from "@/lib/planner/data";
import type { ScheduleSolution } from "@/lib/planner/solve-schedules-core";

export type PlannerHistorySnapshot = {
  plannerItems: PlannerItemRow[];
  blackouts: PlannerBlackoutsDocV1;
  solutions: ScheduleSolution[];
};

const DEFAULT_PLANNER_HISTORY_MAX_ENTRIES = 50;

export function capturePlannerHistorySnapshot(
  input: PlannerHistorySnapshot,
): PlannerHistorySnapshot {
  return structuredClone(input);
}

export type PlannerHistoryStacks = {
  undo: PlannerHistorySnapshot[];
  redo: PlannerHistorySnapshot[];
};

type PlannerHistoryStackState = {
  stacks: PlannerHistoryStacks;
  canUndo: boolean;
  canRedo: boolean;
};

export function createPlannerHistoryStacks(
  maxEntries = DEFAULT_PLANNER_HISTORY_MAX_ENTRIES,
): {
  stacks: PlannerHistoryStacks;
  record: (
    stacks: PlannerHistoryStacks,
    snapshot: PlannerHistorySnapshot,
  ) => PlannerHistoryStackState;
  undo: (
    stacks: PlannerHistoryStacks,
    current: PlannerHistorySnapshot,
  ) => { stacks: PlannerHistoryStacks; snapshot: PlannerHistorySnapshot | null };
  redo: (
    stacks: PlannerHistoryStacks,
    current: PlannerHistorySnapshot,
  ) => { stacks: PlannerHistoryStacks; snapshot: PlannerHistorySnapshot | null };
  clear: () => PlannerHistoryStackState;
} {
  const empty: PlannerHistoryStacks = { undo: [], redo: [] };

  const toState = (stacks: PlannerHistoryStacks): PlannerHistoryStackState => ({
    stacks,
    canUndo: stacks.undo.length > 0,
    canRedo: stacks.redo.length > 0,
  });

  return {
    stacks: empty,
    record(stacks, snapshot) {
      const undo = [...stacks.undo, structuredClone(snapshot)];
      if (undo.length > maxEntries) {
        undo.splice(0, undo.length - maxEntries);
      }
      return toState({ undo, redo: [] });
    },
    undo(stacks, current) {
      if (stacks.undo.length === 0) {
        return { stacks, snapshot: null };
      }
      const undo = stacks.undo.slice(0, -1);
      const snapshot = stacks.undo[stacks.undo.length - 1]!;
      const redo = [...stacks.redo, structuredClone(current)];
      return {
        stacks: { undo, redo },
        snapshot,
      };
    },
    redo(stacks, current) {
      if (stacks.redo.length === 0) {
        return { stacks, snapshot: null };
      }
      const redo = stacks.redo.slice(0, -1);
      const snapshot = stacks.redo[stacks.redo.length - 1]!;
      const undo = [...stacks.undo, structuredClone(current)];
      return {
        stacks: { undo, redo },
        snapshot,
      };
    },
    clear() {
      return toState(empty);
    },
  };
}
