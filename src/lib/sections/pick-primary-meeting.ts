import {
  likelyExamNoteForMeeting,
  type MeetingDayFlags,
} from "./match-exam-meeting";
import type { ExamReservation } from "./parse-exam-reservations";

type TimedMeetingForPrimary = MeetingDayFlags & {
  beginTime: string | null;
  endTime: string | null;
};

type PickPrimaryMeetingOptions = {
  reservations: ExamReservation[];
  /** Full section meetings for pattern inference; defaults to `meetings`. */
  sectionMeetings?: TimedMeetingForPrimary[];
};

/**
 * Index of the meeting to show as primary in section detail / SEO hero.
 * When multiple meetings exist, deprioritizes likely-exam blocks (Banner order
 * among non-exam rows). Single-meeting sections always use index 0.
 */
export function pickPrimaryMeetingIndex(
  meetings: TimedMeetingForPrimary[],
  options: PickPrimaryMeetingOptions,
): number {
  if (meetings.length <= 1) return 0;

  const sectionMeetings = options.sectionMeetings ?? meetings;

  for (let i = 0; i < meetings.length; i++) {
    const match = likelyExamNoteForMeeting(
      meetings[i]!,
      options.reservations,
      sectionMeetings,
    );
    if (!match) return i;
  }

  return 0;
}

/** Puts the primary meeting first; other rows keep their relative order. */
export function reorderMeetingsPrimaryFirst<T>(
  meetings: T[],
  primaryIndex: number,
): T[] {
  if (meetings.length <= 1 || primaryIndex <= 0) return meetings;
  const primary = meetings[primaryIndex];
  if (primary === undefined) return meetings;
  return [
    primary,
    ...meetings.filter((_, i) => i !== primaryIndex),
  ];
}
