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
import { EMPTY_SECTION_PINS, parseSectionPinsJson } from "@/lib/planner/section-pins";

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
  const displayColor = pickUnusedCourseColor(used, term.items.length);
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

function findPlannerCourseItem(
  items: PlannerItemRow[],
  subject: string,
  courseNumber: string,
): PlannerItemRow | undefined {
  if (!plannerHasCourse(items, subject, courseNumber)) return undefined;
  return items.find(
    (i) => i.subject === subject && i.courseNumber === courseNumber,
  );
}

function applySectionPinToItem(
  items: PlannerItemRow[],
  itemId: number,
  scheduleTypeKey: string,
  crn: string,
): PlannerItemRow[] {
  return items.map((r) => {
    if (r.id !== itemId || r.selectionKind !== "unresolved") return r;
    const pins = parseSectionPinsJson(r.sectionPins);
    return {
      ...r,
      sectionPins: {
        v: pins.v,
        byType: { ...pins.byType, [scheduleTypeKey]: crn },
      },
    };
  });
}

/**
 * Add a course if missing, optionally pin a section CRN, and persist. Used by
 * SEO "Add to planner" CTAs so visitors can jump straight into the planner.
 */
export function addCourseWithOptionalPinLocal(input: {
  termCode: string;
  subject: string;
  courseNumber: string;
  sectionPin?: { crn: string; scheduleTypeKey: string };
}):
  | { ok: true; item: PlannerItemRow; items: PlannerItemRow[]; wasAdded: boolean }
  | { ok: false; error: string } {
  const term = readTerm(input.termCode);
  const existing = findPlannerCourseItem(
    term.items,
    input.subject,
    input.courseNumber,
  );

  let wasAdded = false;
  let items = term.items;
  let item: PlannerItemRow | undefined = existing;

  if (!item) {
    const addResult = addCourseLocal({
      termCode: input.termCode,
      subject: input.subject,
      courseNumber: input.courseNumber,
    });
    if (!addResult.ok) return addResult;
    wasAdded = true;
    item = addResult.item;
    items = addResult.items;
  }

  const pin = input.sectionPin;
  const pinKey = pin?.scheduleTypeKey.trim() ?? "";
  if (pin && pinKey.length > 0 && item.selectionKind === "unresolved") {
    items = applySectionPinToItem(items, item.id, pinKey, pin.crn);
    item = items.find((r) => r.id === item!.id) ?? item;
    writeTerm(input.termCode, { items });
  }

  return { ok: true, item, items, wasAdded };
}
