import { describe, expect, it } from "vitest";
import {
  dayIndicesFromMeeting,
  guessExamFromSchedulePattern,
  isMWFSchedule,
  isRegularSchedule,
  isTRSchedule,
  meetingDurationMinutes,
} from "./guess-exam-from-schedule-pattern";

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

const trLecture = {
  beginTime: "1030",
  endTime: "1120",
  monday: false,
  tuesday: true,
  wednesday: false,
  thursday: true,
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

describe("schedule pattern helpers", () => {
  it("classifies MWF and TR day sets", () => {
    expect(isMWFSchedule(dayIndicesFromMeeting(mwfLecture))).toBe(true);
    expect(isTRSchedule(dayIndicesFromMeeting(trLecture))).toBe(true);
    expect(isRegularSchedule(dayIndicesFromMeeting(mwfLecture))).toBe(true);
    expect(isRegularSchedule(dayIndicesFromMeeting(tuesdayExamBlock))).toBe(
      false,
    );
  });

  it("computes meeting duration", () => {
    expect(meetingDurationMinutes(mwfLecture)).toBe(50);
    expect(meetingDurationMinutes(tuesdayExamBlock)).toBe(110);
  });
});

describe("guessExamFromSchedulePattern", () => {
  it("flags MICR-style MWF lecture plus long Tuesday block", () => {
    const sectionMeetings = [mwfLecture, tuesdayExamBlock];
    const match = guessExamFromSchedulePattern(
      sectionMeetings,
      tuesdayExamBlock,
      1,
    );
    expect(match?.likelyExam).toBe(true);
    expect(match?.inferenceSource).toBe("pattern");
    expect(match?.likelyExamLabel).toBe("Likely Exam");
  });

  it("flags TR lecture plus long Thursday block", () => {
    const sectionMeetings = [trLecture, thursdayExamBlock];
    const match = guessExamFromSchedulePattern(
      sectionMeetings,
      thursdayExamBlock,
      3,
    );
    expect(match?.likelyExam).toBe(true);
  });

  it("does not flag exactly 90-minute odd blocks", () => {
    const ninetyMin = {
      ...tuesdayExamBlock,
      endTime: "1840",
    };
    expect(meetingDurationMinutes(ninetyMin)).toBe(90);
    const match = guessExamFromSchedulePattern(
      [mwfLecture, ninetyMin],
      ninetyMin,
      1,
    );
    expect(match).toBeNull();
  });

  it("does not flag single-meeting sections", () => {
    expect(
      guessExamFromSchedulePattern([tuesdayExamBlock], tuesdayExamBlock, 1),
    ).toBeNull();
  });

  it("does not flag when only MWF meetings exist", () => {
    expect(
      guessExamFromSchedulePattern([mwfLecture], mwfLecture, 0),
    ).toBeNull();
  });

  it("does not flag regular MWF rows even when long", () => {
    const longMwf = {
      ...mwfLecture,
      endTime: "1200",
    };
    expect(
      guessExamFromSchedulePattern(
        [longMwf, tuesdayExamBlock],
        longMwf,
        0,
      ),
    ).toBeNull();
  });

  it("flags Wed-only long block when TR is the regular row", () => {
    const wedLong = {
      beginTime: "1710",
      endTime: "1900",
      monday: false,
      tuesday: false,
      wednesday: true,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    };
    const match = guessExamFromSchedulePattern(
      [trLecture, wedLong],
      wedLong,
      2,
    );
    expect(match?.likelyExam).toBe(true);
  });

  it("does not flag MWF lecture day when section has odd block elsewhere", () => {
    const match = guessExamFromSchedulePattern(
      [mwfLecture, tuesdayExamBlock],
      mwfLecture,
      0,
    );
    expect(match).toBeNull();
  });
});
