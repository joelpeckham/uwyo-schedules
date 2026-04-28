import type { CalendarBlock } from "@/lib/planner/data";
import { LANDING_PREVIEW_HOUR_AXIS } from "@/components/planner/week-calendar/axis-constants";
import { WeekCalendarView } from "@/components/planner/week-calendar/WeekCalendarView";

const PREVIEW_ROW_PX = 40;
const VISIBLE_DAY_INDICES = [0, 1, 2, 3, 4] as const;

const COLOR_MATH = "#C4733F";
const COLOR_ENGL = "#6A7C56";
const COLOR_COSC = "#B8893A";

function block(
  partial: Pick<
    CalendarBlock,
    "key" | "dayIndex" | "startMinutes" | "endMinutes" | "label" | "color"
  > &
    Partial<CalendarBlock>,
): CalendarBlock {
  return {
    plannerItemId: 0,
    sectionCrn: partial.sectionCrn ?? "0000",
    meetingId: partial.meetingId ?? 0,
    sublabel: partial.sublabel ?? "",
    instructorSublabel: partial.instructorSublabel ?? null,
    subject: partial.subject ?? "",
    courseNumber: partial.courseNumber ?? "",
    sectionScheduleTypeKey: partial.sectionScheduleTypeKey ?? "lecture",
    meetingScheduleType: partial.meetingScheduleType ?? null,
    ...partial,
  };
}

const SAMPLE_BLOCKS: CalendarBlock[] = [
  block({
    key: "math-mon",
    dayIndex: 0,
    startMinutes: 9 * 60,
    endMinutes: 10 * 60,
    label: "MATH 2200",
    color: COLOR_MATH,
    subject: "MATH",
    courseNumber: "2200",
  }),
  block({
    key: "math-wed",
    dayIndex: 2,
    startMinutes: 9 * 60,
    endMinutes: 10 * 60,
    label: "MATH 2200",
    color: COLOR_MATH,
    subject: "MATH",
    courseNumber: "2200",
  }),
  block({
    key: "math-fri",
    dayIndex: 4,
    startMinutes: 9 * 60,
    endMinutes: 10 * 60,
    label: "MATH 2200",
    color: COLOR_MATH,
    subject: "MATH",
    courseNumber: "2200",
  }),
  block({
    key: "engl-tue",
    dayIndex: 1,
    startMinutes: 11 * 60,
    endMinutes: 12 * 60 + 15,
    label: "ENGL 1010",
    color: COLOR_ENGL,
    subject: "ENGL",
    courseNumber: "1010",
  }),
  block({
    key: "engl-thu",
    dayIndex: 3,
    startMinutes: 11 * 60,
    endMinutes: 12 * 60 + 15,
    label: "ENGL 1010",
    color: COLOR_ENGL,
    subject: "ENGL",
    courseNumber: "1010",
  }),
  block({
    key: "cosc-mon",
    dayIndex: 0,
    startMinutes: 14 * 60,
    endMinutes: 15 * 60 + 15,
    label: "COSC 2030",
    color: COLOR_COSC,
    subject: "COSC",
    courseNumber: "2030",
  }),
  block({
    key: "cosc-wed",
    dayIndex: 2,
    startMinutes: 14 * 60,
    endMinutes: 15 * 60 + 15,
    label: "COSC 2030",
    color: COLOR_COSC,
    subject: "COSC",
    courseNumber: "2030",
  }),
  block({
    key: "cosc-lab-thu",
    dayIndex: 3,
    startMinutes: 15 * 60,
    endMinutes: 16 * 60,
    label: "COSC 2030 lab",
    color: COLOR_COSC,
    subject: "COSC",
    courseNumber: "2030",
    sectionScheduleTypeKey: "lab",
    meetingScheduleType: "Lab",
  }),
];

export function PlannerPreview() {
  return (
    <section
      className="border-b border-border bg-muted/20 px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="preview-heading"
    >
      <div className="mx-auto max-w-6xl lg:max-w-[90rem]">
        <h2
          id="preview-heading"
          className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
        >
          Sample week
        </h2>
        <p className="sr-only">
          Sample week preview: MATH 2200 meets Monday, Wednesday, and Friday
          9 to 10 a.m. ENGL 1010 meets Tuesday and Thursday 11 a.m. to 12:15
          p.m. COSC 2030 meets Monday and Wednesday 2 to 3:15 p.m. with a
          linked lab Thursday 3 to 4 p.m. Three courses, no overlaps.
        </p>
        <figure className="mt-8" aria-hidden>
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <WeekCalendarView
              blocks={SAMPLE_BLOCKS}
              visibleDayIndices={VISIBLE_DAY_INDICES}
              rowPx={PREVIEW_ROW_PX}
              hourAxis={LANDING_PREVIEW_HOUR_AXIS}
            />
          </div>
          <figcaption className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Illustrative week, not your real schedule. Three courses, no
            overlaps, lab linked automatically.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
