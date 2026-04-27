import { describe, expect, it } from "vitest";
import { swapSnapStayWins } from "./course-swap-snap";

describe("swapSnapStayWins", () => {
  const snap = 72;

  it("returns false when the pointer is far from the source block", () => {
    expect(swapSnapStayWins(200, 10, snap, true)).toBe(false);
  });

  it("returns true when near source and no ghost is in snap range", () => {
    expect(swapSnapStayWins(10, 200, snap, false)).toBe(true);
  });

  it("returns true when source distance ties the best ghost within snap", () => {
    expect(swapSnapStayWins(10, 10, snap, true)).toBe(true);
  });

  it("returns false when a ghost is clearly closer than the source", () => {
    expect(swapSnapStayWins(20, 5, snap, true)).toBe(false);
  });

  it("returns true when the source is closer than the best ghost", () => {
    expect(swapSnapStayWins(5, 20, snap, true)).toBe(true);
  });
});
