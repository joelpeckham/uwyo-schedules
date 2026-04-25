import { describe, expect, it } from "vitest";
import {
  buildSearchText,
  buildSearchTextForCourse,
  filterCourseEntries,
  formatBannerTimeShort,
  formatFacultyNamesList,
  formatMeetingTimeLine,
  formatMeetingLinesFromRow,
  primaryFacultyName,
} from "./section-format";
import type { SearchResultsRow } from "@/lib/banner-ssb/types";

describe("formatBannerTimeShort", () => {
  it("formats 4-digit afternoon time", () => {
    expect(formatBannerTimeShort("1510")).toBe("3:10 p.m.");
  });
  it("formats 4-digit morning", () => {
    expect(formatBannerTimeShort("0800")).toBe("8:00 a.m.");
  });
});

describe("formatMeetingTimeLine", () => {
  it("combines weekday, time, place, and type", () => {
    const line = formatMeetingTimeLine({
      wednesday: true,
      beginTime: "1510",
      endTime: "1600",
      buildingDescription: "Engineering Building",
      building: "EN",
      room: "2100",
      meetingTypeDescription: "Class",
    });
    expect(line).toContain("Wed");
    expect(line).toContain("3:10");
    expect(line).toContain("4:00");
    expect(line).toContain("Engineering");
    expect(line).toContain("2100");
  });
});

const sampleRow: SearchResultsRow = {
  subject: "PHYS",
  courseNumber: "1110",
  courseReferenceNumber: "10238",
  courseTitle: "General Physics I",
  subjectCourse: "PHYS1110",
  courseDisplay: "1110",
  termDesc: "Fall 2026",
  scheduleTypeDescription: "Discussion",
  linkIdentifier: "D1",
  faculty: [
    {
      displayName: "Barrans, Richard",
      primaryIndicator: true,
    },
  ],
  meetingsFaculty: [
    {
      meetingTime: {
        wednesday: true,
        beginTime: "1510",
        endTime: "1600",
        buildingDescription: "Engineering Building",
        room: "2100",
        meetingScheduleType: "DIS",
        meetingTypeDescription: "Class",
      },
    },
  ],
} as SearchResultsRow;

describe("formatMeetingLinesFromRow and faculty", () => {
  it("returns lines from meetingsFaculty", () => {
    const lines = formatMeetingLinesFromRow(sampleRow);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toMatch(/Wed/i);
  });
  it("picks primary faculty", () => {
    expect(primaryFacultyName(sampleRow)).toBe("Barrans, Richard");
  });
  it("lists faculty display names", () => {
    expect(formatFacultyNamesList(sampleRow)).toEqual(["Barrans, Richard"]);
  });
});

describe("buildSearchText", () => {
  it("includes subject, title, and instructor", () => {
    const t = buildSearchText(sampleRow);
    expect(t.toLowerCase()).toContain("phys");
    expect(t.toLowerCase()).toContain("barrans");
    expect(t.toLowerCase()).toContain("10238");
  });
});

describe("buildSearchTextForCourse and filterCourseEntries", () => {
  it("merges key and all rows for search", () => {
    const t = buildSearchTextForCourse("PHYS|1110", [sampleRow]);
    expect(t.toLowerCase()).toContain("phys");
    expect(t.toLowerCase()).toContain("1110");
  });

  it("filterCourseEntries returns all when query empty", () => {
    const m = new Map<string, SearchResultsRow[]>([
      ["MATH|1000", [{ subject: "MATH", courseNumber: "1000" } as SearchResultsRow]],
      ["PHYS|1110", [sampleRow]],
    ]);
    expect(filterCourseEntries(m, "").length).toBe(2);
  });

  it("filterCourseEntries matches by instructor", () => {
    const m = new Map<string, SearchResultsRow[]>([
      ["MATH|1000", [{ subject: "MATH", courseNumber: "1000" } as SearchResultsRow]],
      ["PHYS|1110", [sampleRow]],
    ]);
    const f = filterCourseEntries(m, "barrans");
    expect(f.map((x) => x[0])).toEqual(["PHYS|1110"]);
  });
});
