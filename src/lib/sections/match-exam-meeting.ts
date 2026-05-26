import { bannerClockToMinutes } from "@/lib/planner/banner-time";
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
          reservation,
        };
      }
      continue;
    }

    if (resStart != null && start >= resStart - TIME_TOLERANCE_MIN) {
      return {
        likelyExam: true,
        likelyExamLabel: likelyExamShortLabel(reservation.kind),
        reservation,
      };
    }
  }

  return null;
}

/** True if any active day on this meeting overlaps a reservation. */
export function likelyExamNoteForMeeting(
  meeting: MeetingDayFlags & {
    beginTime: string | null;
    endTime: string | null;
  },
  reservations: ExamReservation[],
): ExamMeetingMatch | null {
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const match = matchExamMeeting(meeting, dayIndex, reservations);
    if (match) return match;
  }
  return null;
}
