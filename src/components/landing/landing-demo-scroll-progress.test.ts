import { describe, expect, it } from "vitest";

import { computeTargetScrollProgress } from "@/components/landing/landing-demo-scroll-progress";

describe("computeTargetScrollProgress", () => {
  const viewport = 800;
  const targetHeight = 2000;

  it("returns 0 when target top is at viewport top", () => {
    expect(computeTargetScrollProgress(targetHeight, 0, viewport)).toBe(0);
  });

  it("returns 1 when target bottom meets viewport bottom", () => {
    const scrollable = targetHeight - viewport;
    expect(
      computeTargetScrollProgress(targetHeight, -scrollable, viewport),
    ).toBe(1);
  });

  it("increases as target top moves up (scroll down)", () => {
    const mid = computeTargetScrollProgress(targetHeight, -600, viewport);
    const later = computeTargetScrollProgress(targetHeight, -900, viewport);
    expect(later).toBeGreaterThan(mid);
  });

  it("decreases as target top moves down (scroll up)", () => {
    const high = computeTargetScrollProgress(targetHeight, -900, viewport);
    const lower = computeTargetScrollProgress(targetHeight, -600, viewport);
    expect(lower).toBeLessThan(high);
  });
});
