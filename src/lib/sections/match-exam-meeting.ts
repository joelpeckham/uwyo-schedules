import { bannerClockToMinutes } from "@/lib/planner/banner-time";
import { guessExamFromSchedulePattern } from "./guess-exam-from-schedule-pattern";
import type { ExamReservation } from "./parse-exam-reservations";
import { likelyExamShortLabel } from "./parse-exam-reservations";

const DAY_FIELDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type MeetingDayFlags = {
  monday: boolean | null;
  tuesday: boolean | null;
  wednesday: boolean | null;
  thursday: boolean | null;
  friday: boolean | null;
  saturday: boolean | null;
  sunday: boolean | null;
};

export type ExamMeetingMatch = {
  likelyExam: true;
  likelyExamLabel: string;
  reservation: ExamReservation;
  /** How the likely exam was inferred; omitted for legacy text-only matches. */
  inferenceSource?: "text" | "pattern";
};

const TIME_TOLERANCE_MIN = 5;
const EVENING_START_MIN = 17 * 60;

function meetingDayIndices(meeting: MeetingDayFlags): number[] {
  const out: number[] = [];
  for (let i = 0; i < DAY_FIELDS.length; i++) {
    const field = DAY_FIELDS[i];
    if (meeting[field]) out.push(i);
  }
  return out;
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  tolerance: number,
): boolean {
  return aStart <= bEnd + tolerance && bStart - tolerance <= aEnd;
}

/** Returns a match when a meeting overlaps a parsed exam reservation. */
export function matchExamMeeting(
  meeting: MeetingDayFlags & {
    beginTime: string | null;
    endTime: string | null;
  },
  dayIndex: number,
  reservations: ExamReservation[],
): ExamMeetingMatch | null {
  if (reservations.length === 0) return null;

  const start = bannerClockToMinutes(meeting.beginTime);
  const end = bannerClockToMinutes(meeting.endTime);
  if (start == null || end == null) return null;

  const activeDays = meetingDayIndices(meeting);
  if (!activeDays.includes(dayIndex)) return null;

  for (const reservation of reservations) {
    if (!reservation.days.includes(dayIndex)) continue;

    const resStart = reservation.startMinutes;
    const resEnd = reservation.endMinutes;

    if (resStart == null && resEnd == null) {
      if (start >= EVENING_START_MIN) {
        return {
          likelyExam: true,
          likelyExamLabel: likelyExamShortLabel(reservation.kind),
          inferenceSource: "text",
          reservation,
        };
      }
      continue;
    }

    if (resStart != null && resEnd != null) {
      if (rangesOverlap(start, end, resStart, resEnd, TIME_TOLERANCE_MIN)) {
        return {
          likelyExam: true,
          likelyExamLabel: likelyExamShortLabel(reservation.kind),
          inferenceSource: "text",
          reservation,
        };
      }
      continue;
    }

    if (resStart != null && start >= resStart - TIME_TOLERANCE_MIN) {
      return {
        likelyExam: true,
        likelyExamLabel: likelyExamShortLabel(reservation.kind),
        inferenceSource: "text",
        reservation,
      };
    }
  }

  return null;
}

/** Text reservation match first, then schedule-pattern fallback. */
export function resolveLikelyExamMatch(
  meeting: MeetingDayFlags & {
    beginTime: string | null;
    endTime: string | null;
  },
  dayIndex: number,
  reservations: ExamReservation[],
  sectionMeetings: Array<
    MeetingDayFlags & {
      beginTime: string | null;
      endTime: string | null;
    }
  >,
): ExamMeetingMatch | null {
  const textMatch = matchExamMeeting(meeting, dayIndex, reservations);
  if (textMatch) return textMatch;
  return guessExamFromSchedulePattern(sectionMeetings, meeting, dayIndex);
}

/** True if any active day on this meeting is a likely exam. */
export function likelyExamNoteForMeeting(
  meeting: MeetingDayFlags & {
    beginTime: string | null;
    endTime: string | null;
  },
  reservations: ExamReservation[],
  sectionMeetings?: Array<
    MeetingDayFlags & {
      beginTime: string | null;
      endTime: string | null;
    }
  >,
): ExamMeetingMatch | null {
  const meetings = sectionMeetings ?? [meeting];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const match = resolveLikelyExamMatch(
      meeting,
      dayIndex,
      reservations,
      meetings,
    );
    if (match) return match;
  }
  return null;
}
