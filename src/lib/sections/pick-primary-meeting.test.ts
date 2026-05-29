import { describe, expect, it } from "vitest";
import {
  pickPrimaryMeetingIndex,
  reorderMeetingsPrimaryFirst,
} from "./pick-primary-meeting";
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

describe("pickPrimaryMeetingIndex", () => {
  it("prefers MWF lecture when listed before exam block", () => {
    const meetings = [mwfLecture, tuesdayExamBlock];
    expect(
      pickPrimaryMeetingIndex(meetings, {
        reservations: [],
        sectionMeetings: meetings,
      }),
    ).toBe(0);
  });

  it("prefers MWF lecture when exam block is listed first", () => {
    const meetings = [tuesdayExamBlock, mwfLecture];
    expect(
      pickPrimaryMeetingIndex(meetings, {
        reservations: [],
        sectionMeetings: meetings,
      }),
    ).toBe(1);
  });

  it("keeps sole meeting as primary even when likely exam", () => {
    expect(
      pickPrimaryMeetingIndex([tuesdayExamBlock], {
        reservations: [],
        sectionMeetings: [tuesdayExamBlock],
      }),
    ).toBe(0);
  });

  it("keeps sole non-exam meeting at index 0", () => {
    expect(
      pickPrimaryMeetingIndex([mwfLecture], {
        reservations: [],
        sectionMeetings: [mwfLecture],
      }),
    ).toBe(0);
  });

  it("falls back to 0 when every meeting is likely exam", () => {
    const meetings = [tuesdayExamBlock, thursdayExamBlock];
    expect(
      pickPrimaryMeetingIndex(meetings, {
        reservations: [],
        sectionMeetings: meetings,
      }),
    ).toBe(0);
  });

  it("uses text reservations to skip exam block", () => {
    const meetings = [thursdayExamBlock, mwfLecture];
    expect(
      pickPrimaryMeetingIndex(meetings, {
        reservations: [thursdayExamSlot],
        sectionMeetings: meetings,
      }),
    ).toBe(1);
  });
});

describe("reorderMeetingsPrimaryFirst", () => {
  it("moves primary to front without changing relative order of others", () => {
    expect(reorderMeetingsPrimaryFirst(["a", "b", "c"], 1)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("returns same array when primary is already first", () => {
    const meetings = ["a", "b"];
    expect(reorderMeetingsPrimaryFirst(meetings, 0)).toBe(meetings);
  });
});
