import { describe, expect, it } from "vitest";

import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import type { PlannerItemRow } from "@/lib/planner/data";
import { defaultItemScheduleFilters } from "@/lib/planner/schedule-filters";
import {
  auditItemsWithFullSavedSections,
  isCrnClosed,
} from "@/lib/planner/seat-audit";
import type { CourseSolvePack } from "@/lib/planner/solve-schedules-core";

const EMPTY_CATALOG: PlannerCatalogJson = {
  sections: [],
  meetings: [],
  linkedBundles: [],
  linkedBundleMembers: [],
  facultyByCrn: {},
  examReservationsByCrn: {},
  vagueExamNoteByCrn: {},
};

function baseItem(
  patch: Partial<PlannerItemRow> & Pick<PlannerItemRow, "id">,
): PlannerItemRow {
  return {
    id: patch.id,
    sessionId: "",
    termCode: "202610",
    subject: patch.subject ?? "MATH",
    courseNumber: patch.courseNumber ?? "2200",
    displayColor: "#E6194B",
    selectionKind: patch.selectionKind ?? "unresolved",
    anchorCrn: patch.anchorCrn ?? null,
    linkedBundleId: patch.linkedBundleId ?? null,
    instructorPrefs: { v: 1, primary: [] },
    sectionPins: patch.sectionPins ?? { v: 1, byType: {} },
    scheduleFilters: patch.scheduleFilters ?? defaultItemScheduleFilters(),
  };
}

describe("isCrnClosed", () => {
  it("treats missing seat rows as closed", () => {
    expect(isCrnClosed(new Map(), "12345")).toBe(true);
  });

  it("treats zero seats as closed", () => {
    const map = new Map([
      ["12345", { seatsAvailable: 0, openSection: true }],
    ]);
    expect(isCrnClosed(map, "12345")).toBe(true);
  });
});

describe("auditItemsWithFullSavedSections", () => {
  it("flags locked single_crn when anchor is full", () => {
    const item = baseItem({
      id: 1,
      selectionKind: "single_crn",
      anchorCrn: "12345",
    });
    const packs: CourseSolvePack[] = [
      {
        v: 1,
        courseKey: "MATH\u00002200",
        termCode: "202610",
        subject: "MATH",
        courseNumber: "2200",
        seatsByCrn: {
          "12345": { seatsAvailable: 0, openSection: true },
        },
        candidates: [],
        bundleMembersById: {},
        meetingsByCrn: {},
        facultyByCrn: {},
        scheduleTypeByCrn: {},
        deliveryModeByCrn: {},
      },
    ];
    const hits = auditItemsWithFullSavedSections(
      [item],
      packs,
      EMPTY_CATALOG,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe(1);
  });

  it("skips items when exclude full is already off", () => {
    const item = baseItem({
      id: 1,
      selectionKind: "single_crn",
      anchorCrn: "12345",
      scheduleFilters: {
        v: 1,
        requireOpenSections: false,
        excludeTba: true,
        excludeOnlineAsync: true,
      },
    });
    const packs: CourseSolvePack[] = [
      {
        v: 1,
        courseKey: "MATH\u00002200",
        termCode: "202610",
        subject: "MATH",
        courseNumber: "2200",
        seatsByCrn: {
          "12345": { seatsAvailable: 0, openSection: true },
        },
        candidates: [],
        bundleMembersById: {},
        meetingsByCrn: {},
        facultyByCrn: {},
        scheduleTypeByCrn: {},
        deliveryModeByCrn: {},
      },
    ];
    expect(
      auditItemsWithFullSavedSections([item], packs, EMPTY_CATALOG),
    ).toHaveLength(0);
  });

  it("flags unresolved items with full pinned sections", () => {
    const item = baseItem({
      id: 2,
      sectionPins: { v: 1, byType: { lecture: "99999" } },
    });
    const packs: CourseSolvePack[] = [
      {
        v: 1,
        courseKey: "MATH\u00002200",
        termCode: "202610",
        subject: "MATH",
        courseNumber: "2200",
        seatsByCrn: {
          "99999": { seatsAvailable: 0, openSection: null },
        },
        candidates: [],
        bundleMembersById: {},
        meetingsByCrn: {},
        facultyByCrn: {},
        scheduleTypeByCrn: {},
        deliveryModeByCrn: {},
      },
    ];
    expect(
      auditItemsWithFullSavedSections([item], packs, EMPTY_CATALOG),
    ).toHaveLength(1);
  });
});
