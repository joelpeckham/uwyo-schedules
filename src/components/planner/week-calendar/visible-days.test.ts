import { describe, expect, it } from "vitest";
import {
  isPlannerWeekendDayMuted,
  plannerGridDayIndices,
  visibleDayIndicesForBlocks,
  visibleDayIndicesMerged,
} from "./visible-days";

describe("visibleDayIndicesForBlocks", () => {
  it("returns weekdays only when no Sat/Sun blocks", () => {
    expect(visibleDayIndicesForBlocks([{ dayIndex: 0 }, { dayIndex: 4 }])).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(visibleDayIndicesForBlocks([])).toEqual([0, 1, 2, 3, 4]);
  });

  it("adds only Saturday or only Sunday when just that day has blocks", () => {
    expect(visibleDayIndicesForBlocks([{ dayIndex: 5 }])).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(visibleDayIndicesForBlocks([{ dayIndex: 6 }])).toEqual([
      0, 1, 2, 3, 4, 6,
    ]);
    expect(
      visibleDayIndicesForBlocks([{ dayIndex: 1 }, { dayIndex: 5 }]),
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("includes both weekend columns when blocks use Saturday and Sunday", () => {
    expect(
      visibleDayIndicesForBlocks([{ dayIndex: 5 }, { dayIndex: 6 }]),
    ).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("visibleDayIndicesMerged", () => {
  it("adds Saturday when only a blackout uses Saturday", () => {
    expect(
      visibleDayIndicesMerged([{ dayIndex: 0 }], [{ dayIndex: 5 }]),
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("plannerGridDayIndices", () => {
  it("always returns seven columns for the interactive grid", () => {
    expect(plannerGridDayIndices()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("isPlannerWeekendDayMuted", () => {
  it("mutes empty weekend columns only", () => {
    expect(isPlannerWeekendDayMuted(4, [{ dayIndex: 0 }], [])).toBe(false);
    expect(isPlannerWeekendDayMuted(5, [{ dayIndex: 0 }], [])).toBe(true);
    expect(isPlannerWeekendDayMuted(5, [{ dayIndex: 5 }], [])).toBe(false);
    expect(isPlannerWeekendDayMuted(6, [], [{ dayIndex: 6 }])).toBe(false);
  });
});
