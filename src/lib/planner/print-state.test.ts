import { describe, expect, it } from "vitest";
import type { PlannerItemRow } from "./data";
import type { PlannerCatalogJson } from "./client/catalog-types";
import { buildCalendarBlocksFromCatalog } from "./client/derive";
import {
  applyResolvedSelectionsToPlannerItems,
  decodePrintSelections,
  encodePrintSelections,
} from "./print-state";

const minimalCatalog: PlannerCatalogJson = {
  sections: [
    {
      crn: "10002",
      subject: "MATH",
      courseNumber: "2200",
      scheduleTypeDescription: "Lecture",
      sequenceNumber: "1",
      subjectCourse: "MATH 2200",
      courseTitle: "Calculus I",
      instructionalMethod: "TR",
      instructionalMethodDescription: "Traditional",
      creditHours: 3,
      creditHourLow: null,
      creditHourHigh: null,
      creditHourIndicator: null,
      seatsAvailable: 12,
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
      buildingDescription: "Ross Hall",
      room: "101",
      startDate: null,
      endDate: null,
    },
  ],
  linkedBundles: [],
  linkedBundleMembers: [],
  facultyByCrn: { "10002": "Smith, Jane" },
  examReservationsByCrn: {},
  vagueExamNoteByCrn: {},
};

function unresolvedItem(id: number): PlannerItemRow {
  return {
    id,
    selectionKind: "unresolved",
    anchorCrn: null,
    linkedBundleId: null,
  } as unknown as PlannerItemRow;
}

describe("encodePrintSelections / decodePrintSelections", () => {
  it("roundtrips resolved selections", () => {
    const items = [
      {
        id: 7,
        selectionKind: "single_crn",
        anchorCrn: "10002",
        linkedBundleId: null,
      },
    ] as unknown as PlannerItemRow[];
    const encoded = encodePrintSelections(items);
    const decoded = decodePrintSelections(encoded);
    expect(decoded).toEqual({
      7: {
        selectionKind: "single_crn",
        anchorCrn: "10002",
        linkedBundleId: null,
      },
    });
  });

  it("returns null for invalid payloads", () => {
    expect(decodePrintSelections("")).toBeNull();
    expect(decodePrintSelections("not-valid")).toBeNull();
  });
});

describe("applyResolvedSelectionsToPlannerItems", () => {
  it("produces calendar blocks for unresolved rows with selections applied", () => {
    const items = [unresolvedItem(1)];
    const applied = applyResolvedSelectionsToPlannerItems(items, {
      1: {
        selectionKind: "single_crn",
        anchorCrn: "10002",
        linkedBundleId: null,
      },
    });
    const blocks = buildCalendarBlocksFromCatalog(applied, minimalCatalog);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.sectionCrn).toBe("10002");
    expect(blocks[0]!.dayIndex).toBe(0);
    expect(blocks[0]!.instructorSublabel).toBe("Smith, Jane");
  });

  it("encode → decode → apply yields blocks from unresolved wish-list rows", () => {
    const items = [unresolvedItem(3)];
    const resolved = [
      {
        id: 3,
        selectionKind: "single_crn",
        anchorCrn: "10002",
        linkedBundleId: null,
      },
    ] as unknown as PlannerItemRow[];
    const payload = encodePrintSelections(resolved);
    const selections = decodePrintSelections(payload);
    expect(selections).not.toBeNull();
    const applied = applyResolvedSelectionsToPlannerItems(items, selections!);
    const blocks = buildCalendarBlocksFromCatalog(applied, minimalCatalog);
    expect(blocks.length).toBeGreaterThan(0);
  });
});
