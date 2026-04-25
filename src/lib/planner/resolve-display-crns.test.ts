import { describe, expect, it } from "vitest";
import {
  resolveDisplayCrnsSync,
  type PlannerItemSelection,
} from "./resolve-display-crns";

describe("resolveDisplayCrnsSync", () => {
  it("single_crn returns anchor only", () => {
    const item: PlannerItemSelection = {
      selectionKind: "single_crn",
      anchorCrn: "10224",
      linkedBundleId: null,
    };
    expect(resolveDisplayCrnsSync(item, [])).toEqual(["10224"]);
  });

  it("linked_bundle unions anchor and members", () => {
    const item: PlannerItemSelection = {
      selectionKind: "linked_bundle",
      anchorCrn: "10224",
      linkedBundleId: 1,
    };
    expect(resolveDisplayCrnsSync(item, ["10238", "10230"])).toEqual([
      "10224",
      "10238",
      "10230",
    ]);
  });

  it("dedupes when member repeats anchor", () => {
    const item: PlannerItemSelection = {
      selectionKind: "linked_bundle",
      anchorCrn: "10224",
      linkedBundleId: 1,
    };
    expect(resolveDisplayCrnsSync(item, ["10224", "10230"])).toEqual([
      "10224",
      "10230",
    ]);
  });
});
