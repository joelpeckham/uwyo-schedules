import { describe, expect, it } from "vitest";
import {
  normalizeMeetingScheduleType,
  normalizeScheduleTypeKey,
} from "./swap-helpers";

describe("normalizeScheduleTypeKey", () => {
  it("trims and lowercases", () => {
    expect(normalizeScheduleTypeKey("  Lecture ")).toBe("lecture");
  });
  it("handles null", () => {
    expect(normalizeScheduleTypeKey(null)).toBe("");
  });
});

describe("normalizeMeetingScheduleType", () => {
  it("uppercases", () => {
    expect(normalizeMeetingScheduleType("lec")).toBe("LEC");
  });
  it("returns null for blank", () => {
    expect(normalizeMeetingScheduleType("  ")).toBe(null);
  });
});
