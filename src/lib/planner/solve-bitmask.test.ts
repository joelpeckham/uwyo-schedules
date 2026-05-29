import { describe, expect, it } from "vitest";
import {
  buildBitmaskBasis,
  intervalsToMask,
  masksConflict,
  maskOrInto,
  maskXorInto,
  validCandidateIntervals,
} from "./solve-bitmask";

describe("solve-bitmask", () => {
  it("detects overlap via masks", () => {
    const ivs = [
      { dayIndex: 0, start: 600, end: 660 },
      { dayIndex: 0, start: 630, end: 690 },
    ];
    const basis = buildBitmaskBasis(ivs);
    const a = intervalsToMask([ivs[0]!], basis);
    const b = intervalsToMask([ivs[1]!], basis);
    expect(masksConflict(a, b)).toBe(true);
  });

  it("no conflict on adjacent non-overlapping slots", () => {
    const ivs = [
      { dayIndex: 0, start: 600, end: 660 },
      { dayIndex: 0, start: 660, end: 720 },
    ];
    const basis = buildBitmaskBasis(ivs);
    const a = intervalsToMask([ivs[0]!], basis);
    const b = intervalsToMask([ivs[1]!], basis);
    expect(masksConflict(a, b)).toBe(false);
  });

  it("xor undoes or when masks do not overlap elsewhere", () => {
    const ivs = [
      { dayIndex: 0, start: 600, end: 660 },
      { dayIndex: 1, start: 600, end: 660 },
    ];
    const basis = buildBitmaskBasis(ivs);
    const acc = new Uint32Array(basis.totalWords);
    const m0 = intervalsToMask([ivs[0]!], basis);
    const m1 = intervalsToMask([ivs[1]!], basis);
    maskOrInto(acc, m0);
    maskOrInto(acc, m1);
    maskXorInto(acc, m1);
    expect(masksConflict(acc, m1)).toBe(false);
    for (let i = 0; i < acc.length; i++) {
      expect(acc[i]).toBe(m0[i]);
    }
  });

  it("validCandidateIntervals rejects self-overlap", () => {
    const meetings = new Map([
      [
        "X",
        [
          { dayIndex: 0, start: 600, end: 700 },
          { dayIndex: 0, start: 650, end: 750 },
        ],
      ],
    ]);
    expect(
      validCandidateIntervals({ crns: ["X"] }, meetings, []),
    ).toBeNull();
  });
});
