import { describe, expect, it } from "vitest";
import type { CourseSearchDoc } from "./data";
import {
  normalizeCode,
  normalizeText,
  rankCourses,
} from "./course-search";

function doc(
  partial: Partial<CourseSearchDoc> & Pick<CourseSearchDoc, "subject" | "courseNumber">,
): CourseSearchDoc {
  return {
    termCode: "202610",
    subjectCourse: `${partial.subject} ${partial.courseNumber}`,
    previewTitle: null,
    subjectDescription: null,
    crns: [],
    instructors: [],
    ...partial,
  };
}

describe("normalizeCode", () => {
  it("strips spaces and punctuation from course codes", () => {
    expect(normalizeCode("PHYS 1110")).toBe("phys1110");
    expect(normalizeCode("PHYS1110")).toBe("phys1110");
  });
});

describe("normalizeText", () => {
  it("maps Roman numerals to Arabic digits", () => {
    expect(normalizeText("Calculus II")).toBe("calculus 2");
    expect(normalizeText("calc 2")).toBe("calc 2");
  });
});

describe("rankCourses", () => {
  const index: CourseSearchDoc[] = [
    doc({
      subject: "PHYS",
      courseNumber: "1110",
      subjectCourse: "PHYS 1110",
      previewTitle: "General Physics I",
      subjectDescription: "Physics",
      crns: ["12345", "12346"],
    }),
    doc({
      subject: "MATH",
      courseNumber: "2200",
      subjectCourse: "MATH 2200",
      previewTitle: "Calculus II",
      subjectDescription: "Mathematics",
      instructors: ["Jane Smith"],
    }),
    doc({
      subject: "CHEM",
      courseNumber: "1000",
      previewTitle: "Introduction to Chemistry",
    }),
  ];

  it("matches PHYS1110 and PHYS 1110 to the same course", () => {
    const a = rankCourses(index, "PHYS1110");
    const b = rankCourses(index, "PHYS 1110");
    expect(a[0]?.subject).toBe("PHYS");
    expect(a[0]?.courseNumber).toBe("1110");
    expect(b[0]?.subject).toBe("PHYS");
    expect(b[0]?.courseNumber).toBe("1110");
  });

  it("matches Calculus II via Calc 2 style queries", () => {
    const hits = rankCourses(index, "calc 2");
    expect(hits[0]?.subject).toBe("MATH");
    expect(hits[0]?.courseNumber).toBe("2200");
  });

  it("ranks exact CRN above course code matches", () => {
    const hits = rankCourses(index, "12345");
    expect(hits[0]?.subject).toBe("PHYS");
    expect(hits[0]?.courseNumber).toBe("1110");
  });

  it("ranks course code above title when both could match", () => {
    const hits = rankCourses(index, "MATH 2200");
    expect(hits[0]?.subject).toBe("MATH");
  });

  it("matches instructor names", () => {
    const hits = rankCourses(index, "Smith");
    expect(hits[0]?.subject).toBe("MATH");
  });

  it("returns empty for blank query", () => {
    expect(rankCourses(index, "")).toEqual([]);
    expect(rankCourses(index, "   ")).toEqual([]);
  });
});
