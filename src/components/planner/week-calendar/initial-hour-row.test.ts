import { describe, expect, it } from "vitest";
import { initialPlannerHourRowPx } from "./constants";

describe("initialPlannerHourRowPx", () => {
  it("clamps row height between 44 and 140 px", () => {
    const row = initialPlannerHourRowPx(20);
    expect(row).toBeGreaterThanOrEqual(44);
    expect(row).toBeLessThanOrEqual(140);
  });
});
