import { describe, expect, it } from "vitest";

import { EMPTY_TIME_PREFS } from "@/lib/planner/time-prefs";
import {
  capturePlannerHistorySnapshot,
  createPlannerHistoryStacks,
} from "@/lib/planner/planner-action-history";

const EMPTY_BLACKOUTS = { v: 1 as const, items: [] };

const baseFilters = {
  requireOpenSections: true,
  excludeTba: true,
  excludeOnlineAsync: true,
};

function snap(items: { id: number }[] = []) {
  return capturePlannerHistorySnapshot({
    plannerItems: items as never,
    blackouts: EMPTY_BLACKOUTS,
    timePrefs: EMPTY_TIME_PREFS,
    filters: baseFilters,
  });
}

describe("capturePlannerHistorySnapshot", () => {
  it("deep-clones so later mutations do not alias", () => {
    const input = snap([{ id: 1 }]);
    input.plannerItems.push({ id: 2 } as never);
    const captured = capturePlannerHistorySnapshot({
      plannerItems: [{ id: 1 }] as never,
      blackouts: EMPTY_BLACKOUTS,
      timePrefs: EMPTY_TIME_PREFS,
      filters: baseFilters,
    });
    expect(captured.plannerItems).toHaveLength(1);
  });
});

describe("createPlannerHistoryStacks", () => {
  it("record pushes undo and clears redo", () => {
    const history = createPlannerHistoryStacks(3);
    let state = history.record(history.stacks, snap([{ id: 1 }]));
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);

    const withRedo = {
      undo: state.stacks.undo,
      redo: [snap([{ id: 99 }])],
    };
    state = history.record(withRedo, snap([{ id: 2 }]));
    expect(state.stacks.redo).toHaveLength(0);
    expect(state.stacks.undo).toHaveLength(2);
  });

  it("caps undo stack at maxEntries", () => {
    const history = createPlannerHistoryStacks(2);
    let stacks = history.stacks;
    stacks = history.record(stacks, snap([{ id: 1 }])).stacks;
    stacks = history.record(stacks, snap([{ id: 2 }])).stacks;
    const state = history.record(stacks, snap([{ id: 3 }]));
    expect(state.stacks.undo.map((s) => s.plannerItems[0]?.id)).toEqual([2, 3]);
  });

  it("undo restores prior snapshot and pushes current to redo", () => {
    const history = createPlannerHistoryStacks();
    const s1 = snap([{ id: 1 }]);
    const s2 = snap([{ id: 2 }]);
    let stacks = history.record(history.stacks, s1).stacks;
    stacks = history.record(stacks, s2).stacks;
    const current = snap([{ id: 3 }]);
    const result = history.undo(stacks, current);
    expect(result.snapshot?.plannerItems[0]?.id).toBe(2);
    expect(result.stacks.redo).toHaveLength(1);
    expect(result.stacks.redo[0]?.plannerItems[0]?.id).toBe(3);
    expect(result.stacks.undo).toHaveLength(1);
  });

  it("redo restores from redo stack", () => {
    const history = createPlannerHistoryStacks();
    const s1 = snap([{ id: 1 }]);
    const stacks = history.record(history.stacks, s1).stacks;
    const undone = history.undo(stacks, snap([{ id: 2 }]));
    const redone = history.redo(undone.stacks, snap([{ id: 1 }]));
    expect(redone.snapshot?.plannerItems[0]?.id).toBe(2);
  });

  it("clear resets both stacks", () => {
    const history = createPlannerHistoryStacks();
    const state = history.clear();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });
});
