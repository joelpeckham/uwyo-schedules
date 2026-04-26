import { describe, expect, it } from "vitest";
import {
  visibleDayIndicesForBlocks,
  visibleDayIndicesMerged,
} from "./WeekCalendar";

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
