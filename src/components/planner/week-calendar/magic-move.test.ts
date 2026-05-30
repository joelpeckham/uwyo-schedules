import { describe, expect, it } from "vitest";
import type { CalendarBlock } from "@/lib/planner/data";
import { buildMagicMoveIdMap, magicMoveSlotKey } from "./magic-move";

function block(
  overrides: Partial<CalendarBlock> & Pick<CalendarBlock, "key" | "dayIndex">,
): CalendarBlock {
  return {
    plannerItemId: 1,
    sectionCrn: "10001",
    meetingId: 10,
    startMinutes: 540,
    endMinutes: 590,
    label: "MATH 2200",
    sublabel: "EN 100",
    instructorSublabel: null,
    seatsAvailable: null,
    buildingShort: null,
    color: "#000",
    subject: "MATH",
    courseNumber: "2200",
    sectionScheduleTypeKey: "lecture",
    meetingScheduleType: null,
    likelyExam: false,
    likelyExamLabel: null,
    likelyExamInferenceSource: null,
    ...overrides,
  };
}

describe("magicMoveSlotKey", () => {
  it("formats planner item, schedule type, and slot index", () => {
    expect(magicMoveSlotKey(42, "lecture", 2)).toBe("42:lecture:2");
  });
});

describe("buildMagicMoveIdMap", () => {
  it("assigns slot indices sorted by day then time within a group", () => {
    const mon = block({ key: "mon", dayIndex: 0, startMinutes: 540 });
    const wed = block({ key: "wed", dayIndex: 2, startMinutes: 540 });
    const fri = block({ key: "fri", dayIndex: 4, startMinutes: 540 });

    const map = buildMagicMoveIdMap([wed, fri, mon]);

    expect(map.get("mon")).toBe("1:lecture:0");
    expect(map.get("wed")).toBe("1:lecture:1");
    expect(map.get("fri")).toBe("1:lecture:2");
  });

  it("MWF to TTh keeps slot 0 and 1 for cross-day morph; slot 2 is distinct", () => {
    const mwf = [
      block({ key: "mwf-mon", dayIndex: 0, sectionCrn: "A" }),
      block({ key: "mwf-wed", dayIndex: 2, sectionCrn: "A" }),
      block({ key: "mwf-fri", dayIndex: 4, sectionCrn: "A" }),
    ];
    const tth = [
      block({ key: "tth-tue", dayIndex: 1, sectionCrn: "B" }),
      block({ key: "tth-thu", dayIndex: 3, sectionCrn: "B" }),
    ];

    const mwfMap = buildMagicMoveIdMap(mwf);
    const tthMap = buildMagicMoveIdMap(tth);

    expect(mwfMap.get("mwf-mon")).toBe(tthMap.get("tth-tue"));
    expect(mwfMap.get("mwf-wed")).toBe(tthMap.get("tth-thu"));
    expect(mwfMap.get("mwf-fri")).toBe("1:lecture:2");
    expect(tthMap.has("mwf-fri")).toBe(false);
  });

  it("separates groups by planner item and schedule type", () => {
    const lecture = block({
      key: "lec",
      dayIndex: 0,
      sectionScheduleTypeKey: "lecture",
    });
    const lab = block({
      key: "lab",
      dayIndex: 0,
      sectionScheduleTypeKey: "laboratory",
      plannerItemId: 1,
    });
    const otherCourse = block({
      key: "other",
      dayIndex: 0,
      plannerItemId: 99,
    });

    const map = buildMagicMoveIdMap([lecture, lab, otherCourse]);

    expect(map.get("lec")).toBe("1:lecture:0");
    expect(map.get("lab")).toBe("1:laboratory:0");
    expect(map.get("other")).toBe("99:lecture:0");
  });
});
