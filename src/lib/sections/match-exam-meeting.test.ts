import { describe, expect, it } from "vitest";
import {
  matchExamMeeting,
  resolveLikelyExamMatch,
} from "./match-exam-meeting";
import type { ExamReservation } from "./parse-exam-reservations";

const thursdayExamSlot: ExamReservation = {
  days: [3],
  startMinutes: 17 * 60 + 10,
  endMinutes: 19 * 60,
  kind: "exam",
  sourceText: "Reserve Thursday evenings 5:10-7pm for exams",
};

const mwfLecture = {
  beginTime: "0900",
  endTime: "0950",
  monday: true,
  tuesday: false,
  wednesday: true,
  thursday: false,
  friday: true,
  saturday: false,
  sunday: false,
};

const tuesdayExamBlock = {
  beginTime: "1710",
  endTime: "1900",
  monday: false,
  tuesday: true,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
  sunday: false,
};

const thursdayExamBlock = {
  beginTime: "1710",
  endTime: "1900",
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: true,
  friday: false,
  saturday: false,
  sunday: false,
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

describe("resolveLikelyExamMatch", () => {
  it("prefers text reservation over schedule pattern", () => {
    const sectionMeetings = [mwfLecture, thursdayExamBlock];
    const match = resolveLikelyExamMatch(
      thursdayExamBlock,
      3,
      [thursdayExamSlot],
      sectionMeetings,
    );
    expect(match?.inferenceSource).toBe("text");
  });

  it("uses schedule pattern when reservations are empty", () => {
    const sectionMeetings = [mwfLecture, tuesdayExamBlock];
    const match = resolveLikelyExamMatch(
      tuesdayExamBlock,
      1,
      [],
      sectionMeetings,
    );
    expect(match?.likelyExam).toBe(true);
    expect(match?.inferenceSource).toBe("pattern");
  });
});
