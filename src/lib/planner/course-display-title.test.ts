import { describe, expect, it } from "vitest";
import type { ClientCatalogSection } from "./client/catalog-types";
import { courseDisplayTitle } from "./course-display-title";

function section(
  partial: Pick<ClientCatalogSection, "crn" | "courseTitle"> &
    Partial<ClientCatalogSection>,
): ClientCatalogSection {
  return {
    crn: partial.crn,
    subject: partial.subject ?? "PHYS",
    courseNumber: partial.courseNumber ?? "1110",
    scheduleTypeDescription: partial.scheduleTypeDescription ?? "Lecture",
    sequenceNumber: partial.sequenceNumber ?? "1",
    subjectCourse: partial.subjectCourse ?? "PHYS 1110",
    courseTitle: partial.courseTitle,
    instructionalMethod: partial.instructionalMethod ?? null,
    instructionalMethodDescription: partial.instructionalMethodDescription ?? null,
    creditHours: partial.creditHours ?? 4,
    creditHourLow: partial.creditHourLow ?? null,
    creditHourHigh: partial.creditHourHigh ?? null,
    creditHourIndicator: partial.creditHourIndicator ?? null,
    seatsAvailable: partial.seatsAvailable ?? null,
  };
}

describe("courseDisplayTitle", () => {
  it("prefers lecture section title", () => {
    const sections = [
      section({
        crn: "1",
        scheduleTypeDescription: "Laboratory",
        courseTitle: "Laboratory - Repeat Lecture",
      }),
      section({
        crn: "2",
        scheduleTypeDescription: "Lecture",
        courseTitle: "General Physics I",
      }),
    ];
    expect(courseDisplayTitle(sections, "PHYS", "1110")).toBe("General Physics I");
  });

  it("skips lab-repeat boilerplate when no lecture title", () => {
    const sections = [
      section({
        crn: "1",
        scheduleTypeDescription: "Laboratory",
        courseTitle: "Laboratory - Repeat Lecture",
      }),
      section({
        crn: "2",
        scheduleTypeDescription: "Discussion",
        courseTitle: "General Physics I",
      }),
    ];
    expect(courseDisplayTitle(sections, "PHYS", "1110")).toBe("General Physics I");
  });

  it("falls back to any title when only boilerplate remains", () => {
    const sections = [
      section({
        crn: "1",
        scheduleTypeDescription: "Laboratory",
        courseTitle: "Laboratory - Repeat Lecture",
      }),
    ];
    expect(courseDisplayTitle(sections, "PHYS", "1110")).toBe(
      "Laboratory - Repeat Lecture",
    );
  });

  it("returns null when course has no titled sections", () => {
    const sections = [
      section({ crn: "1", courseTitle: null }),
      section({ crn: "2", courseTitle: "   " }),
    ];
    expect(courseDisplayTitle(sections, "PHYS", "1110")).toBeNull();
  });

  it("strips section suffix from lecture title", () => {
    const sections = [
      section({
        crn: "1",
        subject: "CHEM",
        courseNumber: "1020",
        scheduleTypeDescription: "Lecture",
        courseTitle: "Gen Chemistry I - Sec 2",
      }),
    ];
    expect(courseDisplayTitle(sections, "CHEM", "1020")).toBe("Gen Chemistry I");
  });
});
