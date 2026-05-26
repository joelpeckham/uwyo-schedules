import { describe, expect, it } from "vitest";
import { parseCourseDescriptionHtml } from "./parse-course-description";

const LIFE_HTML = `
<section aria-labelledby="courseDescription">
    Fundamental concepts of biology.<br/>
        <b>Section information text:</b><br/>
        Tuesday 5:10-6:50 pm reserved for midterm exams
</section>`;

const PHYS_HTML = `
<section aria-labelledby="courseDescription">
    First course of two-semester sequence.<br/>
        <b>Section information text:</b><br/>
        Students must enroll in a laboratory; Reserve Thursday evenings 5:10-7pm for exams
</section>`;

describe("parseCourseDescriptionHtml", () => {
  it("extracts course and section information text", () => {
    const parsed = parseCourseDescriptionHtml(LIFE_HTML);
    expect(parsed.courseDescription).toContain("Fundamental concepts");
    expect(parsed.sectionInformationText).toBe(
      "Tuesday 5:10-6:50 pm reserved for midterm exams",
    );
  });

  it("extracts section information from PHYS-style HTML", () => {
    const parsed = parseCourseDescriptionHtml(PHYS_HTML);
    expect(parsed.sectionInformationText).toContain(
      "Reserve Thursday evenings 5:10-7pm for exams",
    );
  });

  it("returns null section text when absent", () => {
    const parsed = parseCourseDescriptionHtml(
      "<section>Only a course blurb here.<br/></section>",
    );
    expect(parsed.sectionInformationText).toBeNull();
  });
});
