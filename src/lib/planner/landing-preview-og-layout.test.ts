import { describe, expect, it } from "vitest";
import { LANDING_PREVIEW_HOUR_AXIS } from "@/components/planner/week-calendar/axis-constants";
import { LANDING_PREVIEW_BLOCKS } from "@/lib/planner/landing-preview-blocks";
import {
  LANDING_PREVIEW_OG_DRAG_SCENARIO,
  layoutMeetingRectForHourAxis,
  layoutPreviewBlocksForHourAxis,
} from "@/lib/planner/landing-preview-og-layout";

describe("layoutMeetingRectForHourAxis", () => {
  it("places 10 a.m. ENGL at the second hour row when axis starts at 8", () => {
    const rowPx = 26;
    const rect = layoutMeetingRectForHourAxis(
      10 * 60,
      11 * 60 + 15,
      LANDING_PREVIEW_HOUR_AXIS,
      rowPx,
    );
    expect(rect.topPx).toBe(2 * rowPx);
    expect(rect.heightPx).toBeGreaterThan(rowPx);
  });
});

describe("LANDING_PREVIEW_OG_DRAG_SCENARIO", () => {
  it("uses Mon, Wed, Fri ghost slots that do not overlap existing blocks", () => {
    const ghostDays = LANDING_PREVIEW_OG_DRAG_SCENARIO.ghosts.map((g) => g.dayIndex);
    expect(ghostDays).toEqual([0, 2, 4]);

    const byDay = layoutPreviewBlocksForHourAxis(
      LANDING_PREVIEW_BLOCKS,
      LANDING_PREVIEW_HOUR_AXIS,
      26,
    );

    for (const ghost of LANDING_PREVIEW_OG_DRAG_SCENARIO.ghosts) {
      const rect = layoutMeetingRectForHourAxis(
        ghost.startMinutes,
        ghost.endMinutes,
        LANDING_PREVIEW_HOUR_AXIS,
        26,
      );
      const dayBlocks = byDay.get(ghost.dayIndex) ?? [];
      for (const { topPx, heightPx } of dayBlocks) {
        const ghostEnd = rect.topPx + rect.heightPx;
        const blockEnd = topPx + heightPx;
        const overlaps =
          rect.topPx < blockEnd && ghostEnd > topPx;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("highlights Wednesday as the snapped ghost target", () => {
    const snapped = LANDING_PREVIEW_OG_DRAG_SCENARIO.ghosts.filter((g) => g.snapped);
    expect(snapped).toHaveLength(1);
    expect(snapped[0]?.dayIndex).toBe(2);
  });
});

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
