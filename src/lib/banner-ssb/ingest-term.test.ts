import { describe, expect, it } from "vitest";
import { applyPreservedSectionDescriptions } from "./ingest-term";

describe("applyPreservedSectionDescriptions", () => {
  it("copies cached description fields when CRN exists in prior map", () => {
    const fetchedAt = new Date("2026-05-01T12:00:00Z");
    const preserved = new Map([
      [
        "11568",
        {
          courseDescription: "Intro physics prose.",
          sectionInformationText: "Exam on Friday.",
          descriptionsFetchedAt: fetchedAt,
        },
      ],
    ]);

    const section = {
      termCode: "202710",
      crn: "11568",
      subject: "PHYS",
      courseNumber: "1110",
      rawJson: {},
    };

    const merged = applyPreservedSectionDescriptions(
      {
        ...section,
        courseDescription: null,
        sectionInformationText: null,
        descriptionsFetchedAt: null,
      },
      preserved,
    );
    expect(merged.courseDescription).toBe("Intro physics prose.");
    expect(merged.sectionInformationText).toBe("Exam on Friday.");
    expect(merged.descriptionsFetchedAt).toBe(fetchedAt);
    expect(merged.subject).toBe("PHYS");
  });

  it("leaves section unchanged when CRN was not previously cached", () => {
    const preserved = new Map<
      string,
      {
        courseDescription: string | null;
        sectionInformationText: string | null;
        descriptionsFetchedAt: Date | null;
      }
    >();

    const section = {
      termCode: "202710",
      crn: "99999",
      subject: "MATH",
      courseNumber: "2200",
      rawJson: {},
    };

    const merged = applyPreservedSectionDescriptions(section, preserved);
    expect(merged).toEqual(section);
  });
});
