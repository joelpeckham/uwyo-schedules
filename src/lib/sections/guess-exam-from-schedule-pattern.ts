import { bannerClockToMinutes } from "@/lib/planner/banner-time";
import type { ExamMeetingMatch, MeetingDayFlags } from "./match-exam-meeting";
import { likelyExamShortLabel } from "./parse-exam-reservations";

const MWF_DAYS = [0, 2, 4] as const;
const TR_DAYS = [1, 3] as const;
const LONG_MEETING_MIN = 90;

export const PATTERN_EXAM_SOURCE_TEXT =
  "Inferred from schedule pattern (extra-long meeting outside MWF/TR)";

type TimedMeeting = MeetingDayFlags & {
  beginTime: string | null;
  endTime: string | null;
};

function setsEqual(a: number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((v, i) => v === sortedB[i]);
}

/** Active day indices 0=Mon … 6=Sun for a meeting row. */
export function dayIndicesFromMeeting(meeting: MeetingDayFlags): number[] {
  const out: number[] = [];
  if (meeting.monday) out.push(0);
  if (meeting.tuesday) out.push(1);
  if (meeting.wednesday) out.push(2);
  if (meeting.thursday) out.push(3);
  if (meeting.friday) out.push(4);
  if (meeting.saturday) out.push(5);
  if (meeting.sunday) out.push(6);
  return out;
}

export function isMWFSchedule(days: number[]): boolean {
  return setsEqual(days, MWF_DAYS);
}

export function isTRSchedule(days: number[]): boolean {
  return setsEqual(days, TR_DAYS);
}

export function isRegularSchedule(days: number[]): boolean {
  return isMWFSchedule(days) || isTRSchedule(days);
}

export function meetingDurationMinutes(meeting: TimedMeeting): number | null {
  const start = bannerClockToMinutes(meeting.beginTime);
  const end = bannerClockToMinutes(meeting.endTime);
  if (start == null || end == null || end <= start) return null;
  return end - start;
}

function isSameMeetingRow(a: TimedMeeting, b: TimedMeeting): boolean {
  return (
    a.beginTime === b.beginTime &&
    a.endTime === b.endTime &&
    a.monday === b.monday &&
    a.tuesday === b.tuesday &&
    a.wednesday === b.wednesday &&
    a.thursday === b.thursday &&
    a.friday === b.friday &&
    a.saturday === b.saturday &&
    a.sunday === b.sunday
  );
}

/**
 * Guess exam when a section has a classic MWF/TR row plus an extra-long meeting
 * on a non-MWF/TR day (e.g. MICR 2021 Tuesday 5:10–7:00 with MWF lecture).
 */
export function guessExamFromSchedulePattern(
  sectionMeetings: TimedMeeting[],
  targetMeeting: TimedMeeting,
  dayIndex: number,
): ExamMeetingMatch | null {
  if (sectionMeetings.length < 2) return null;

  const targetDays = dayIndicesFromMeeting(targetMeeting);
  if (!targetDays.includes(dayIndex)) return null;

  const hasRegularRow = sectionMeetings.some((m) => {
    const days = dayIndicesFromMeeting(m);
    return isRegularSchedule(days);
  });
  if (!hasRegularRow) return null;

  const targetDuration = meetingDurationMinutes(targetMeeting);
  if (targetDuration == null || targetDuration <= LONG_MEETING_MIN) return null;

  if (isRegularSchedule(targetDays)) return null;

  const matchingTarget = sectionMeetings.find((m) =>
    isSameMeetingRow(m, targetMeeting),
  );
  if (!matchingTarget) return null;

  const start = bannerClockToMinutes(targetMeeting.beginTime);
  const end = bannerClockToMinutes(targetMeeting.endTime);

  return {
    likelyExam: true,
    likelyExamLabel: likelyExamShortLabel("unknown"),
    inferenceSource: "pattern",
    reservation: {
      days: [dayIndex],
      startMinutes: start,
      endMinutes: end,
      kind: "unknown",
      sourceText: PATTERN_EXAM_SOURCE_TEXT,
    },
  };
}
