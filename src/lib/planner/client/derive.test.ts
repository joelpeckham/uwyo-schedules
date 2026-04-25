import { describe, expect, it } from "vitest";
import type { PlannerCatalogJson } from "./catalog-types";
import { listSameTypeSwapGhostsFromCatalog } from "./derive";

const minimalCatalog: PlannerCatalogJson = {
  sections: [
    {
      crn: "10001",
      subject: "MATH",
      courseNumber: "2200",
      scheduleTypeDescription: "Lecture",
      sequenceNumber: "1",
      subjectCourse: "MATH 2200",
    },
    {
      crn: "10002",
      subject: "MATH",
      courseNumber: "2200",
      scheduleTypeDescription: "Lecture",
      sequenceNumber: "2",
      subjectCourse: "MATH 2200",
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
    },
  ],
  linkedBundles: [],
  linkedBundleMembers: [],
};

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
