import type { CalendarBlock } from "@/lib/planner/data";

const COLOR_CHEM = "#B8893A";
const COLOR_ENGL = "#6A7C56";
const COLOR_MATH = "#C4733F";

type LandingDemoCandidateSlot = {
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
  conflict?: boolean;
};

function block(
  partial: Pick<
    CalendarBlock,
    "key" | "dayIndex" | "startMinutes" | "endMinutes" | "label" | "color"
  > &
    Partial<CalendarBlock>,
): CalendarBlock {
  return {
    plannerItemId: partial.plannerItemId ?? 0,
    sectionCrn: partial.sectionCrn ?? "0000",
    meetingId: partial.meetingId ?? 0,
    sublabel: partial.sublabel ?? "",
    instructorSublabel: partial.instructorSublabel ?? null,
    seatsAvailable: partial.seatsAvailable ?? null,
    buildingShort: partial.buildingShort ?? null,
    subject: partial.subject ?? "",
    courseNumber: partial.courseNumber ?? "",
    sectionScheduleTypeKey: partial.sectionScheduleTypeKey ?? "lecture",
    meetingScheduleType: partial.meetingScheduleType ?? null,
    likelyExam: partial.likelyExam ?? false,
    likelyExamLabel: partial.likelyExamLabel ?? null,
    likelyExamInferenceSource: partial.likelyExamInferenceSource ?? null,
    ...partial,
  };
}

/** Tuesday ENGL 1010 lecture — dragged during the landing scroll demo. */
export const LANDING_DEMO_DRAGGABLE_KEY = "engl-tue";

/** MATH 1400 Wednesday lecture — overlaps the drop target. */
export const LANDING_DEMO_CONFLICT_BLOCK_KEY = "math-wed";

/** Wed 10–11:15 a.m. — user drops here despite overlapping MATH. */
export const LANDING_DEMO_TARGET = {
  dayIndex: 2,
  startMinutes: 10 * 60,
  endMinutes: 11 * 60 + 15,
} as const;

/** ENGL Tue source slot for geometry (same as start block). */
export const LANDING_DEMO_SOURCE = {
  dayIndex: 1,
  startMinutes: 11 * 60,
  endMinutes: 12 * 60 + 15,
} as const;

export const LANDING_DEMO_CANDIDATE_SLOTS: readonly LandingDemoCandidateSlot[] =
  [
    { dayIndex: 0, startMinutes: 11 * 60, endMinutes: 12 * 60 + 15 },
    { dayIndex: 1, startMinutes: 8 * 60, endMinutes: 9 * 60 + 15 },
    {
      dayIndex: 2,
      startMinutes: 10 * 60,
      endMinutes: 11 * 60 + 15,
      conflict: true,
    },
    { dayIndex: 2, startMinutes: 13 * 60, endMinutes: 14 * 60 + 15 },
    { dayIndex: 3, startMinutes: 14 * 60, endMinutes: 15 * 60 + 15 },
    { dayIndex: 4, startMinutes: 11 * 60, endMinutes: 12 * 60 + 15 },
  ];

export const LANDING_DEMO_PINNED_KEYS = [
  "chem-mon",
  "chem-wed",
  "chem-fri",
  "chem-lab-tue",
  "chem-exam-thu",
] as const;

const CHEM_BLOCKS: CalendarBlock[] = [
  block({
    key: "chem-mon",
    plannerItemId: 1,
    sectionCrn: "10001",
    meetingId: 1,
    dayIndex: 0,
    startMinutes: 9 * 60,
    endMinutes: 9 * 60 + 50,
    label: "CHEM 1020",
    color: COLOR_CHEM,
    subject: "CHEM",
    courseNumber: "1020",
    sublabel: "PS 100",
    instructorSublabel: "Chen, L.",
    seatsAvailable: 8,
    buildingShort: "Physical Sciences",
  }),
  block({
    key: "chem-wed",
    plannerItemId: 1,
    sectionCrn: "10001",
    meetingId: 2,
    dayIndex: 2,
    startMinutes: 9 * 60,
    endMinutes: 9 * 60 + 50,
    label: "CHEM 1020",
    color: COLOR_CHEM,
    subject: "CHEM",
    courseNumber: "1020",
    sublabel: "PS 100",
    instructorSublabel: "Chen, L.",
    seatsAvailable: 8,
    buildingShort: "Physical Sciences",
  }),
  block({
    key: "chem-fri",
    plannerItemId: 1,
    sectionCrn: "10001",
    meetingId: 3,
    dayIndex: 4,
    startMinutes: 9 * 60,
    endMinutes: 9 * 60 + 50,
    label: "CHEM 1020",
    color: COLOR_CHEM,
    subject: "CHEM",
    courseNumber: "1020",
    sublabel: "PS 100",
    instructorSublabel: "Chen, L.",
    seatsAvailable: 8,
    buildingShort: "Physical Sciences",
  }),
  block({
    key: "chem-lab-tue",
    plannerItemId: 1,
    sectionCrn: "10001",
    meetingId: 4,
    dayIndex: 1,
    startMinutes: 13 * 60,
    endMinutes: 14 * 60 + 50,
    label: "CHEM 1020 lab",
    color: COLOR_CHEM,
    subject: "CHEM",
    courseNumber: "1020",
    sectionScheduleTypeKey: "lab",
    meetingScheduleType: "Lab",
    sublabel: "PS 212",
    instructorSublabel: "Chen, L.",
    seatsAvailable: 8,
    buildingShort: "Physical Sciences",
  }),
  block({
    key: "chem-exam-thu",
    plannerItemId: 1,
    sectionCrn: "10001",
    meetingId: 5,
    dayIndex: 3,
    startMinutes: 15 * 60,
    endMinutes: 16 * 60,
    label: "CHEM 1020",
    color: COLOR_CHEM,
    subject: "CHEM",
    courseNumber: "1020",
    sublabel: "PS 100",
    instructorSublabel: "Chen, L.",
    seatsAvailable: 8,
    buildingShort: "Physical Sciences",
    likelyExam: true,
    likelyExamLabel: "Exam",
    likelyExamInferenceSource: "pattern",
  }),
];

const ENGL_START_BLOCKS: CalendarBlock[] = [
  block({
    key: "engl-tue",
    plannerItemId: 2,
    sectionCrn: "20002",
    meetingId: 6,
    dayIndex: 1,
    startMinutes: 11 * 60,
    endMinutes: 12 * 60 + 15,
    label: "ENGL 1010",
    color: COLOR_ENGL,
    subject: "ENGL",
    courseNumber: "1010",
    sublabel: "CR 302",
    instructorSublabel: "Rivera, M.",
    seatsAvailable: 4,
    buildingShort: "Classroom Building",
  }),
  block({
    key: "engl-thu",
    plannerItemId: 2,
    sectionCrn: "20002",
    meetingId: 7,
    dayIndex: 3,
    startMinutes: 11 * 60,
    endMinutes: 12 * 60 + 15,
    label: "ENGL 1010",
    color: COLOR_ENGL,
    subject: "ENGL",
    courseNumber: "1010",
    sublabel: "CR 302",
    instructorSublabel: "Rivera, M.",
    seatsAvailable: 4,
    buildingShort: "Classroom Building",
  }),
];

const MATH_START_BLOCKS: CalendarBlock[] = [
  block({
    key: "math-mon",
    plannerItemId: 3,
    sectionCrn: "30003",
    meetingId: 8,
    dayIndex: 0,
    startMinutes: 10 * 60,
    endMinutes: 10 * 60 + 50,
    label: "MATH 1400",
    color: COLOR_MATH,
    subject: "MATH",
    courseNumber: "1400",
    sublabel: "ENG 145",
    instructorSublabel: "Nguyen, T.",
    seatsAvailable: 12,
    buildingShort: "Engineering Building",
  }),
  block({
    key: "math-wed",
    plannerItemId: 3,
    sectionCrn: "30003",
    meetingId: 9,
    dayIndex: 2,
    startMinutes: 10 * 60,
    endMinutes: 10 * 60 + 50,
    label: "MATH 1400",
    color: COLOR_MATH,
    subject: "MATH",
    courseNumber: "1400",
    sublabel: "ENG 145",
    instructorSublabel: "Nguyen, T.",
    seatsAvailable: 12,
    buildingShort: "Engineering Building",
  }),
  block({
    key: "math-fri",
    plannerItemId: 3,
    sectionCrn: "30003",
    meetingId: 10,
    dayIndex: 4,
    startMinutes: 10 * 60,
    endMinutes: 10 * 60 + 50,
    label: "MATH 1400",
    color: COLOR_MATH,
    subject: "MATH",
    courseNumber: "1400",
    sublabel: "ENG 145",
    instructorSublabel: "Nguyen, T.",
    seatsAvailable: 12,
    buildingShort: "Engineering Building",
  }),
];

/** Conflict-free starting week before the user drags ENGL. */
export const LANDING_DEMO_START_BLOCKS: CalendarBlock[] = [
  ...CHEM_BLOCKS,
  ...ENGL_START_BLOCKS,
  ...MATH_START_BLOCKS,
];

const ENGL_RESOLVED_BLOCKS: CalendarBlock[] = [
  block({
    key: "engl-wed",
    plannerItemId: 2,
    sectionCrn: "20002",
    meetingId: 6,
    dayIndex: 2,
    startMinutes: 10 * 60,
    endMinutes: 11 * 60 + 15,
    label: "ENGL 1010",
    color: COLOR_ENGL,
    subject: "ENGL",
    courseNumber: "1010",
    sublabel: "CR 302",
    instructorSublabel: "Rivera, M.",
    seatsAvailable: 4,
    buildingShort: "Classroom Building",
  }),
  ENGL_START_BLOCKS[1]!,
];

const MATH_RESOLVED_BLOCKS: CalendarBlock[] = [
  block({
    key: "math-mon",
    plannerItemId: 3,
    sectionCrn: "30003",
    meetingId: 8,
    dayIndex: 0,
    startMinutes: 13 * 60,
    endMinutes: 13 * 60 + 50,
    label: "MATH 1400",
    color: COLOR_MATH,
    subject: "MATH",
    courseNumber: "1400",
    sublabel: "ENG 145",
    instructorSublabel: "Nguyen, T.",
    seatsAvailable: 12,
    buildingShort: "Engineering Building",
  }),
  block({
    key: "math-wed",
    plannerItemId: 3,
    sectionCrn: "30003",
    meetingId: 9,
    dayIndex: 2,
    startMinutes: 13 * 60,
    endMinutes: 13 * 60 + 50,
    label: "MATH 1400",
    color: COLOR_MATH,
    subject: "MATH",
    courseNumber: "1400",
    sublabel: "ENG 145",
    instructorSublabel: "Nguyen, T.",
    seatsAvailable: 12,
    buildingShort: "Engineering Building",
  }),
  block({
    key: "math-fri",
    plannerItemId: 3,
    sectionCrn: "30003",
    meetingId: 10,
    dayIndex: 4,
    startMinutes: 13 * 60,
    endMinutes: 13 * 60 + 50,
    label: "MATH 1400",
    color: COLOR_MATH,
    subject: "MATH",
    courseNumber: "1400",
    sublabel: "ENG 145",
    instructorSublabel: "Nguyen, T.",
    seatsAvailable: 12,
    buildingShort: "Engineering Building",
  }),
];

/** Rearranged week after the planner resolves the conflicting drop. */
export const LANDING_DEMO_RESOLVED_BLOCKS: CalendarBlock[] = [
  ...CHEM_BLOCKS,
  ...ENGL_RESOLVED_BLOCKS,
  ...MATH_RESOLVED_BLOCKS,
];

export const LANDING_DEMO_DRAGGABLE_BLOCK = LANDING_DEMO_START_BLOCKS.find(
  (b) => b.key === LANDING_DEMO_DRAGGABLE_KEY,
)!;
