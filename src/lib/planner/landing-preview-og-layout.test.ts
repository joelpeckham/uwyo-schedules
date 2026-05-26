import { describe, expect, it } from "vitest";
import { LANDING_PREVIEW_HOUR_AXIS } from "@/components/planner/week-calendar/axis-constants";
import { LANDING_PREVIEW_BLOCKS } from "@/lib/planner/landing-preview-blocks";
import { layoutPreviewBlocksForHourAxis } from "@/lib/planner/landing-preview-og-layout";

describe("layoutPreviewBlocksForHourAxis", () => {
  it("places 9 a.m. MATH on Monday at the first hour row", () => {
    const rowPx = 32;
    const byDay = layoutPreviewBlocksForHourAxis(
      LANDING_PREVIEW_BLOCKS,
      LANDING_PREVIEW_HOUR_AXIS,
      rowPx,
    );
    const mon = byDay.get(0) ?? [];
    const math = mon.find((l) => l.block.key === "math-mon");
    expect(math?.topPx).toBe(rowPx);
    expect(math?.heightPx).toBe(rowPx);
  });

  it("includes Tuesday discussion after ENGL", () => {
    const byDay = layoutPreviewBlocksForHourAxis(
      LANDING_PREVIEW_BLOCKS,
      LANDING_PREVIEW_HOUR_AXIS,
      32,
    );
    const tue = byDay.get(1) ?? [];
    expect(tue.map((l) => l.block.key).sort()).toEqual([
      "cosc-disc-tue",
      "engl-tue",
    ]);
  });
});
