import { describe, expect, it } from "vitest";

import {
  demoCandidateOpacity,
  demoHeldOpacity,
  demoSnapTargetOpacity,
  isDemoDragging,
  isDemoResolved,
  lerpKeyframes,
} from "@/components/landing/use-landing-demo-geometry";
import {
  LANDING_DEMO_CANDIDATE_SLOTS,
  LANDING_DEMO_CONFLICT_BLOCK_KEY,
  LANDING_DEMO_DRAGGABLE_KEY,
  LANDING_DEMO_ENGL_MAGIC_IDS,
  LANDING_DEMO_PINNED_KEYS,
  LANDING_DEMO_RESOLVED_BLOCKS,
  LANDING_DEMO_START_BLOCKS,
  LANDING_DEMO_TARGET,
  landingDemoMagicIdForBlock,
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

  it("flags one snap-target candidate slot on Wednesday at 10 a.m.", () => {
    const snapSlots = LANDING_DEMO_CANDIDATE_SLOTS.filter(
      (slot) => slot.isSnapTarget,
    );
    expect(snapSlots).toHaveLength(1);
    expect(snapSlots[0]).toMatchObject(LANDING_DEMO_TARGET);
    expect(LANDING_DEMO_CANDIDATE_SLOTS.map((s) => s.dayIndex).sort()).toEqual([
      0, 2, 4,
    ]);
  });

  it("resolves ENGL to MWF at 10 a.m. and shifts MATH to the afternoon", () => {
    const englMon = LANDING_DEMO_RESOLVED_BLOCKS.find((b) => b.key === "engl-mon");
    const englWed = LANDING_DEMO_RESOLVED_BLOCKS.find((b) => b.key === "engl-wed");
    const englFri = LANDING_DEMO_RESOLVED_BLOCKS.find((b) => b.key === "engl-fri");
    const mathWed = LANDING_DEMO_RESOLVED_BLOCKS.find(
      (b) => b.key === LANDING_DEMO_CONFLICT_BLOCK_KEY,
    );
    const englTue = LANDING_DEMO_RESOLVED_BLOCKS.find(
      (b) => b.key === LANDING_DEMO_DRAGGABLE_KEY,
    );
    const englThu = LANDING_DEMO_RESOLVED_BLOCKS.find((b) => b.key === "engl-thu");

    expect(englTue).toBeUndefined();
    expect(englThu).toBeUndefined();
    for (const block of [englMon, englWed, englFri]) {
      expect(block).toMatchObject({
        startMinutes: 10 * 60,
        endMinutes: 11 * 60 + 15,
      });
    }
    expect(mathWed?.startMinutes).toBe(13 * 60);
  });

  it("keeps pinned CHEM blocks unchanged between start and resolved", () => {
    for (const key of LANDING_DEMO_PINNED_KEYS) {
      const start = LANDING_DEMO_START_BLOCKS.find((b) => b.key === key);
      const resolved = LANDING_DEMO_RESOLVED_BLOCKS.find((b) => b.key === key);
      expect(resolved).toEqual(start);
    }
  });

  it("assigns magic-move ids for Thu→Fri slide and Mon/Wed fade in", () => {
    const thu = LANDING_DEMO_START_BLOCKS.find((b) => b.key === "engl-thu")!;
    const fri = LANDING_DEMO_RESOLVED_BLOCKS.find((b) => b.key === "engl-fri")!;
    const mon = LANDING_DEMO_RESOLVED_BLOCKS.find((b) => b.key === "engl-mon")!;
    const wed = LANDING_DEMO_RESOLVED_BLOCKS.find((b) => b.key === "engl-wed")!;
    const tue = LANDING_DEMO_START_BLOCKS.find((b) => b.key === "engl-tue")!;

    expect(landingDemoMagicIdForBlock(thu)).toBe(
      LANDING_DEMO_ENGL_MAGIC_IDS.thuToFri,
    );
    expect(landingDemoMagicIdForBlock(fri)).toBe(
      LANDING_DEMO_ENGL_MAGIC_IDS.thuToFri,
    );
    expect(landingDemoMagicIdForBlock(mon)).toBe(
      LANDING_DEMO_ENGL_MAGIC_IDS.enterMon,
    );
    expect(landingDemoMagicIdForBlock(wed)).toBe(
      LANDING_DEMO_ENGL_MAGIC_IDS.enterWed,
    );
    expect(landingDemoMagicIdForBlock(tue)).toBe(
      LANDING_DEMO_ENGL_MAGIC_IDS.exitTue,
    );
    expect(landingDemoMagicIdForBlock(
      LANDING_DEMO_START_BLOCKS.find((b) => b.key === "math-mon")!,
    )).toBe("math-mon");
  });
});

describe("landing demo scroll helpers", () => {
  it("lerps between keyframe stops", () => {
    expect(lerpKeyframes(0, [0, 1], [10, 20])).toBe(10);
    expect(lerpKeyframes(0.5, [0, 1], [10, 20])).toBe(15);
    expect(lerpKeyframes(1, [0, 1], [10, 20])).toBe(20);
  });

  it("tracks drag and resolve phases", () => {
    expect(isDemoDragging(0.1)).toBe(false);
    expect(isDemoDragging(0.4)).toBe(true);
    expect(isDemoDragging(0.63)).toBe(false);
    expect(isDemoResolved(0.61)).toBe(false);
    expect(isDemoResolved(0.62)).toBe(true);
  });

  it("fades held card and candidate overlays during drag window", () => {
    expect(demoHeldOpacity(0.1)).toBe(0);
    expect(demoHeldOpacity(0.4)).toBe(1);
    expect(demoHeldOpacity(0.62)).toBe(0);
    expect(demoCandidateOpacity(0.1)).toBe(0);
    expect(demoCandidateOpacity(0.4)).toBeGreaterThan(0);
    expect(demoSnapTargetOpacity(0.5)).toBeGreaterThan(
      demoCandidateOpacity(0.5),
    );
  });
});
