import { describe, expect, it } from "vitest";
import { matchExamMeeting } from "./match-exam-meeting";
import type { ExamReservation } from "./parse-exam-reservations";

const thursdayExamSlot: ExamReservation = {
  days: [3],
  startMinutes: 17 * 60 + 10,
  endMinutes: 19 * 60,
  kind: "exam",
  sourceText: "Reserve Thursday evenings 5:10-7pm for exams",
};

describe("matchExamMeeting", () => {
  it("matches PHYS-style Thursday evening meeting", () => {
    const match = matchExamMeeting(
      {
        beginTime: "1710",
        endTime: "1900",
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: true,
        friday: false,
        saturday: false,
        sunday: false,
      },
      3,
      [thursdayExamSlot],
    );
    expect(match?.likelyExam).toBe(true);
    expect(match?.likelyExamLabel).toBe("Likely Exam");
  });

  it("does not match regular MWF lecture on a different day", () => {
    const match = matchExamMeeting(
      {
        beginTime: "0900",
        endTime: "0950",
        monday: true,
        tuesday: false,
        wednesday: true,
        thursday: false,
        friday: true,
        saturday: false,
        sunday: false,
      },
      0,
      [thursdayExamSlot],
    );
    expect(match).toBeNull();
  });
});
