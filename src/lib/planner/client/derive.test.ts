import { describe, expect, it } from "vitest";
import type { PlannerItemRow } from "@/lib/planner/data";
import type { PlannerCatalogJson } from "./catalog-types";
import {
  buildCalendarBlocksFromCatalog,
  collectDisplayCrnsForItems,
  listSameTypeSwapGhostsFromCatalog,
} from "./derive";

const minimalCatalog: PlannerCatalogJson = {
  sections: [
    {
      crn: "10001",
      subject: "MATH",
      courseNumber: "2200",
      scheduleTypeDescription: "Lecture",
      sequenceNumber: "1",
      subjectCourse: "MATH 2200",
      instructionalMethod: "TR",
      instructionalMethodDescription: "Traditional",
      creditHours: 3,
      seatsAvailable: 12,
    },
    {
      crn: "10002",
      subject: "MATH",
      courseNumber: "2200",
      scheduleTypeDescription: "Lecture",
      sequenceNumber: "2",
      subjectCourse: "MATH 2200",
      instructionalMethod: "TR",
      instructionalMethodDescription: "Traditional",
      creditHours: 3,
      seatsAvailable: null,
    },
  ],
  meetings: [
    {
      id: 1,
      sectionCrn: "10002",
      beginTime: "1000",
      endTime: "1050",
      meetingScheduleType: null,
      monday: true,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
      building: null,
      buildingDescription: null,
      room: null,
      startDate: null,
      endDate: null,
    },
  ],
  linkedBundles: [],
  linkedBundleMembers: [],
  facultyByCrn: {},
  examReservationsByCrn: {},
  vagueExamNoteByCrn: {},
};

describe("collectDisplayCrnsForItems", () => {
  it("returns unique anchor CRNs in planner item order", () => {
    const items = [
      {
        id: 1,
        selectionKind: "single_crn",
        anchorCrn: "10001",
        linkedBundleId: null,
      },
      {
        id: 2,
        selectionKind: "single_crn",
        anchorCrn: "10002",
        linkedBundleId: null,
      },
    ] as unknown as PlannerItemRow[];
    expect(collectDisplayCrnsForItems(items, minimalCatalog)).toEqual([
      "10001",
      "10002",
    ]);
  });
});

describe("listSameTypeSwapGhostsFromCatalog", () => {
  it("returns ghosts for same schedule type excluding source CRN", () => {
    const ghosts = listSameTypeSwapGhostsFromCatalog(minimalCatalog, {
      subject: "MATH",
      courseNumber: "2200",
      excludeSectionCrn: "10001",
      sourceScheduleTypeKey: "lecture",
      sourceMeetingScheduleType: null,
    });
    expect(ghosts.some((g) => g.crn === "10002")).toBe(true);
    expect(ghosts.every((g) => g.crn !== "10001")).toBe(true);
  });
});

describe("buildCalendarBlocksFromCatalog", () => {
  it("marks blocks that match parsed exam reservations", () => {
    const catalog: PlannerCatalogJson = {
      ...minimalCatalog,
      meetings: [
        {
          id: 10,
          sectionCrn: "10001",
          beginTime: "1710",
          endTime: "1900",
          meetingScheduleType: "LEC",
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: true,
          friday: false,
          saturday: false,
          sunday: false,
          building: null,
          buildingDescription: null,
          room: null,
          startDate: null,
          endDate: null,
        },
      ],
      examReservationsByCrn: {
        "10001": [
          {
            days: [3],
            startMinutes: 17 * 60 + 10,
            endMinutes: 19 * 60,
            kind: "exam",
            sourceText: "Reserve Thursday evenings 5:10-7pm for exams",
          },
        ],
      },
      vagueExamNoteByCrn: {},
    };
    const items = [
      {
        id: 1,
        selectionKind: "single_crn",
        anchorCrn: "10001",
        linkedBundleId: null,
        subject: "MATH",
        courseNumber: "2200",
        displayColor: "#000",
      },
    ] as unknown as PlannerItemRow[];
    const blocks = buildCalendarBlocksFromCatalog(items, catalog);
    const thursday = blocks.find((b) => b.dayIndex === 3);
    expect(thursday?.likelyExam).toBe(true);
    expect(thursday?.likelyExamLabel).toBe("Likely Exam");
  });

  it("marks pattern-inferred exam blocks when section info has no reservation", () => {
    const catalog: PlannerCatalogJson = {
      ...minimalCatalog,
      meetings: [
        {
          id: 20,
          sectionCrn: "10001",
          beginTime: "0900",
          endTime: "0950",
          meetingScheduleType: "LEC",
          monday: true,
          tuesday: false,
          wednesday: true,
          thursday: false,
          friday: true,
          saturday: false,
          sunday: false,
          building: null,
          buildingDescription: null,
          room: null,
          startDate: null,
          endDate: null,
        },
        {
          id: 21,
          sectionCrn: "10001",
          beginTime: "1710",
          endTime: "1900",
          meetingScheduleType: "LEC",
          monday: false,
          tuesday: true,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false,
          building: null,
          buildingDescription: null,
          room: null,
          startDate: null,
          endDate: null,
        },
      ],
      examReservationsByCrn: {},
      vagueExamNoteByCrn: {},
    };
    const items = [
      {
        id: 1,
        selectionKind: "single_crn",
        anchorCrn: "10001",
        linkedBundleId: null,
        subject: "MICR",
        courseNumber: "2021",
        displayColor: "#000",
      },
    ] as unknown as PlannerItemRow[];
    const blocks = buildCalendarBlocksFromCatalog(items, catalog);
    const tuesday = blocks.find((b) => b.dayIndex === 1);
    expect(tuesday?.likelyExam).toBe(true);
    expect(tuesday?.likelyExamInferenceSource).toBe("pattern");
    const monday = blocks.find((b) => b.dayIndex === 0);
    expect(monday?.likelyExam).toBe(false);
  });
});
