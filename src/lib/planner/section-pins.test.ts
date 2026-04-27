import { describe, expect, it } from "vitest";
import { filterCandidatesBySectionPins } from "./section-pins";
import { normalizeScheduleTypeKey } from "./swap-helpers";

describe("filterCandidatesBySectionPins", () => {
  const scheduleTypeByCrn = new Map<string, string | null>([
    ["100", "Lecture"],
    ["101", "Laboratory"],
    ["102", "Laboratory"],
  ]);
  const lec = normalizeScheduleTypeKey("Lecture");

  it("returns all when no pins", () => {
    const cands = [{ crns: ["100", "101"] }, { crns: ["100", "102"] }];
    expect(
      filterCandidatesBySectionPins(
        cands,
        { v: 1, byType: {} },
        scheduleTypeByCrn,
      ),
    ).toEqual(cands);
  });

  it("keeps only candidates that include pinned lecture CRN with matching type", () => {
    const cands = [{ crns: ["100", "101"] }, { crns: ["100", "102"] }];
    const out = filterCandidatesBySectionPins(
      cands,
      { v: 1, byType: { [lec]: "100" } },
      scheduleTypeByCrn,
    );
    expect(out).toEqual(cands);
  });

  it("drops candidates missing pinned CRN", () => {
    const cands = [{ crns: ["100", "101"] }, { crns: ["102", "101"] }];
    const out = filterCandidatesBySectionPins(
      cands,
      { v: 1, byType: { [lec]: "100" } },
      scheduleTypeByCrn,
    );
    expect(out).toEqual([{ crns: ["100", "101"] }]);
  });

  it("drops when pinned CRN type does not match pin key", () => {
    const cands = [{ crns: ["101", "100"] }];
    const wrongKey = normalizeScheduleTypeKey("Discussion");
    const out = filterCandidatesBySectionPins(
      cands,
      { v: 1, byType: { [wrongKey]: "100" } },
      scheduleTypeByCrn,
    );
    expect(out).toEqual([]);
  });
});
