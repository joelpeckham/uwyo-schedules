import { describe, expect, it } from "vitest";

import {
  demoCandidateOpacity,
  demoConflictTargetOpacity,
  demoHeldOpacity,
  isDemoDragging,
  isDemoDropping,
  isDemoResolved,
  lerpKeyframes,
} from "@/components/landing/use-landing-demo-geometry";
import {
  LANDING_DEMO_CANDIDATE_SLOTS,
  LANDING_DEMO_CONFLICT_BLOCK_KEY,
  LANDING_DEMO_DRAGGABLE_KEY,
  LANDING_DEMO_PINNED_KEYS,
  LANDING_DEMO_RESOLVED_BLOCKS,
  LANDING_DEMO_START_BLOCKS,
  LANDING_DEMO_TARGET,
} from "@/lib/planner/landing-preview-demo";

describe("landing-preview-demo", () => {
  it("starts with ENGL on Tuesday and MATH on Wednesday at 10 a.m.", () => {
    const englTue = LANDING_DEMO_START_BLOCKS.find(
      (b) => b.key === LANDING_DEMO_DRAGGABLE_KEY,
    );
    const mathWed = LANDING_DEMO_START_BLOCKS.find(
      (b) => b.key === LANDING_DEMO_CONFLICT_BLOCK_KEY,
    );

    expect(englTue?.dayIndex).toBe(1);
    expect(mathWed?.dayIndex).toBe(2);
    expect(mathWed?.startMinutes).toBe(10 * 60);
  });

  it("flags one conflicting candidate slot on Wednesday morning", () => {
    const conflictSlots = LANDING_DEMO_CANDIDATE_SLOTS.filter(
      (slot) => slot.conflict,
    );
    expect(conflictSlots).toHaveLength(1);
    expect(conflictSlots[0]).toMatchObject(LANDING_DEMO_TARGET);
  });

  it("moves ENGL to Wednesday and shifts MATH to the afternoon when resolved", () => {
    const englWed = LANDING_DEMO_RESOLVED_BLOCKS.find((b) => b.key === "engl-wed");
    const mathWed = LANDING_DEMO_RESOLVED_BLOCKS.find(
      (b) => b.key === LANDING_DEMO_CONFLICT_BLOCK_KEY,
    );
    const englTue = LANDING_DEMO_RESOLVED_BLOCKS.find(
      (b) => b.key === LANDING_DEMO_DRAGGABLE_KEY,
    );

    expect(englTue).toBeUndefined();
    expect(englWed).toMatchObject(LANDING_DEMO_TARGET);
    expect(mathWed?.startMinutes).toBe(13 * 60);
  });

  it("keeps pinned CHEM blocks unchanged between start and resolved", () => {
    for (const key of LANDING_DEMO_PINNED_KEYS) {
      const start = LANDING_DEMO_START_BLOCKS.find((b) => b.key === key);
      const resolved = LANDING_DEMO_RESOLVED_BLOCKS.find((b) => b.key === key);
      expect(resolved).toEqual(start);
    }
  });
});

describe("landing demo scroll helpers", () => {
  it("lerps between keyframe stops", () => {
    expect(lerpKeyframes(0, [0, 1], [10, 20])).toBe(10);
    expect(lerpKeyframes(0.5, [0, 1], [10, 20])).toBe(15);
    expect(lerpKeyframes(1, [0, 1], [10, 20])).toBe(20);
  });

  it("tracks drag, drop, and resolve phases", () => {
    expect(isDemoDragging(0.1)).toBe(false);
    expect(isDemoDragging(0.4)).toBe(true);
    expect(isDemoDragging(0.63)).toBe(false);
    expect(isDemoDropping(0.54)).toBe(false);
    expect(isDemoDropping(0.58)).toBe(true);
    expect(isDemoResolved(0.61)).toBe(false);
    expect(isDemoResolved(0.62)).toBe(true);
  });

  it("fades held card and candidate overlays during drag window", () => {
    expect(demoHeldOpacity(0.1)).toBe(0);
    expect(demoHeldOpacity(0.4)).toBe(1);
    expect(demoCandidateOpacity(0.1)).toBe(0);
    expect(demoCandidateOpacity(0.4)).toBeGreaterThan(0);
    expect(demoConflictTargetOpacity(0.5)).toBeGreaterThan(
      demoCandidateOpacity(0.5),
    );
  });
});
