import { pickUnusedCourseColor } from "@/lib/planner/course-colors";
import { MAX_PLANNER_COURSES_PER_TERM } from "@/lib/planner/constants";
import type { PlannerItemRow } from "@/lib/planner/data";
import { defaultInstructorPrefs } from "@/lib/planner/instructor-prefs";
import {
  allocateNextItemId,
  DUPLICATE_COURSE_ERROR,
  plannerHasCourse,
  readTerm,
  writeTerm,
} from "@/lib/planner/local-state";
import { EMPTY_SECTION_PINS } from "@/lib/planner/section-pins";

/**
 * Append one wish-list course to local storage. Caller should update React state
 * with `items` and trigger catalog prefetch / recalculate as needed.
 */
export function addCourseLocal(input: {
  termCode: string;
  subject: string;
  courseNumber: string;
}):
  | { ok: true; item: PlannerItemRow; items: PlannerItemRow[] }
  | { ok: false; error: string } {
  const term = readTerm(input.termCode);
  if (plannerHasCourse(term.items, input.subject, input.courseNumber)) {
    return { ok: false, error: DUPLICATE_COURSE_ERROR };
  }
  if (term.items.length >= MAX_PLANNER_COURSES_PER_TERM) {
    return {
      ok: false,
      error: `At most ${MAX_PLANNER_COURSES_PER_TERM} courses for one term.`,
    };
  }

  const used = new Set(
    term.items.map((r) => r.displayColor.trim().toLowerCase()),
  );
  const displayColor = pickUnusedCourseColor(used);
  const id = allocateNextItemId();
  const item: PlannerItemRow = {
    id,
    /** Legacy field from Postgres planner_items; unused in local-only mode. */
    sessionId: "",
    termCode: input.termCode,
    subject: input.subject,
    courseNumber: input.courseNumber,
    displayColor,
    selectionKind: "unresolved",
    anchorCrn: null,
    linkedBundleId: null,
    instructorPrefs: defaultInstructorPrefs(),
    sectionPins: EMPTY_SECTION_PINS,
  };
  const items = [...term.items, item];
  writeTerm(input.termCode, { items });
  return { ok: true, item, items };
}
