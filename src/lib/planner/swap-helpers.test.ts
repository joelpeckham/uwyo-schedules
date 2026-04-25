import { describe, expect, it } from "vitest";
import {
  normalizeMeetingScheduleType,
  normalizeScheduleTypeKey,
  pickBestLinkedBundleId,
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

describe("pickBestLinkedBundleId", () => {
  it("returns null for empty options", () => {
    expect(pickBestLinkedBundleId("100", [], ["100", "200"])).toBe(null);
  });

  it("picks highest overlap with current CRNs", () => {
    const id = pickBestLinkedBundleId(
      "A1",
      [
        { id: 1, bundleIndex: 0, memberCrns: ["L1"] },
        { id: 2, bundleIndex: 1, memberCrns: ["L2", "X"] },
      ],
      ["A1", "L2"],
    );
    expect(id).toBe(2);
  });

  it("tie-breaks by lower bundleIndex", () => {
    const id = pickBestLinkedBundleId(
      "A1",
      [
        { id: 10, bundleIndex: 1, memberCrns: ["M"] },
        { id: 20, bundleIndex: 0, memberCrns: ["M"] },
      ],
      ["A1", "M"],
    );
    expect(id).toBe(20);
  });
});
