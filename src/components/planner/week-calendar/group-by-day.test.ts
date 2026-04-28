import { describe, expect, it } from "vitest";
import type { CalendarBlock } from "@/lib/planner/data";
import type { PlannerBlackoutItemV1 } from "@/lib/planner/blackouts";
import type { SwapGhostMeeting } from "@/lib/planner/data";
import {
  groupBlackoutsByDay,
  groupBlocksByDay,
  groupSwapGhostsByDay,
} from "./group-by-day";

function block(dayIndex: number, key: string): CalendarBlock {
  return {
    key,
    dayIndex,
    plannerItemId: 1,
    sectionCrn: "1",
    sectionScheduleTypeKey: "a",
    meetingId: 1,
    startMinutes: 540,
    endMinutes: 600,
    label: "L",
    sublabel: "",
    instructorSublabel: null,
    color: "#000",
    subject: "X",
    courseNumber: "0000",
    meetingScheduleType: null,
  };
}

describe("groupBlocksByDay", () => {
  it("groups multiple blocks on the same day into one array", () => {
    const a = block(0, "a");
    const b = block(0, "b");
    const c = block(2, "c");
    const m = groupBlocksByDay([a, b, c]);
    expect(m.get(0)).toEqual([a, b]);
    expect(m.get(2)).toEqual([c]);
    expect(m.has(1)).toBe(false);
  });
});

describe("groupBlackoutsByDay", () => {
  it("groups by dayIndex", () => {
    const items: PlannerBlackoutItemV1[] = [
      { id: "1", dayIndex: 1, start: 600, end: 660 },
      { id: "2", dayIndex: 1, start: 700, end: 800 },
      { id: "3", dayIndex: 3, start: 480, end: 540 },
    ];
    const m = groupBlackoutsByDay(items);
    expect(m.get(1)?.length).toBe(2);
    expect(m.get(3)?.length).toBe(1);
  });
});

describe("groupSwapGhostsByDay", () => {
  it("returns empty map for nullish ghosts", () => {
    expect(groupSwapGhostsByDay(null).size).toBe(0);
    expect(groupSwapGhostsByDay(undefined).size).toBe(0);
  });

  it("groups ghost meetings by dayIndex", () => {
    const g1: SwapGhostMeeting = {
      crn: "x",
      meetingId: 1,
      dayIndex: 2,
      startMinutes: 0,
      endMinutes: 60,
    };
    const g2: SwapGhostMeeting = { ...g1, dayIndex: 2, crn: "y" };
    const g3: SwapGhostMeeting = { ...g1, dayIndex: 4 };
    const m = groupSwapGhostsByDay([g1, g2, g3]);
    expect(m.get(2)?.length).toBe(2);
    expect(m.get(4)?.length).toBe(1);
  });
});
