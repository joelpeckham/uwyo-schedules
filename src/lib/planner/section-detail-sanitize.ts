/**
 * Shared whitelist + sanitizer for the Banner section JSON tree that
 * `SectionDetailPanels` renders. Used both by the planner server action
 * (which serves the modal) and the public per-CRN page (which renders
 * the same panel inline). Anything outside the whitelist is dropped before
 * the data crosses the wire so we cannot accidentally leak unrelated
 * Banner fields if their API surface changes.
 */

export const SECTION_DETAIL_TOP_KEYS = new Set([
  "subject",
  "courseNumber",
  "sequenceNumber",
  "subjectCourse",
  "courseReferenceNumber",
  "courseTitle",
  "scheduleTypeDescription",
  "campusDescription",
  "instructionalMethod",
  "instructionalMethodDescription",
  "partOfTerm",
  "termDesc",
  "term",
  "creditHours",
  "creditHourLow",
  "creditHourHigh",
  "creditHourIndicator",
  "enrollment",
  "maximumEnrollment",
  "seatsAvailable",
  "waitCapacity",
  "waitCount",
  "waitAvailable",
  "isSectionLinked",
  "linkIdentifier",
  "openSection",
  "courseDescription",
  "sectionInformationText",
  "faculty",
  "meetingsFaculty",
  "sectionAttributes",
  "status",
]);

const FACULTY_KEYS = new Set([
  "displayName",
  "emailAddress",
  "primaryIndicator",
]);
const MEETING_TIME_KEYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "beginTime",
  "endTime",
  "buildingDescription",
  "building",
  "room",
  "startDate",
  "endDate",
  "meetingTypeDescription",
  "meetingType",
  "meetingScheduleType",
]);
const ATTRIBUTE_KEYS = new Set(["code", "description", "isZTCAttribute"]);
const STATUS_KEYS = new Set([
  "sectionOpen",
  "select",
  "restricted",
  "timeConflict",
  "sectionStatus",
]);

function pickKeys(
  src: unknown,
  allowed: Set<string>,
): Record<string, unknown> | null {
  if (src === null || typeof src !== "object" || Array.isArray(src)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

export function sanitizeSectionRawJson(
  raw: unknown,
): Record<string, unknown> | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const top = pickKeys(obj, SECTION_DETAIL_TOP_KEYS);
  if (!top) return null;
  if (Array.isArray(top.faculty)) {
    top.faculty = (top.faculty as unknown[])
      .map((f) => pickKeys(f, FACULTY_KEYS))
      .filter((f): f is Record<string, unknown> => f !== null);
  }
  if (Array.isArray(top.meetingsFaculty)) {
    top.meetingsFaculty = (top.meetingsFaculty as unknown[])
      .map((m) => {
        if (m === null || typeof m !== "object" || Array.isArray(m)) return null;
        const mt = (m as Record<string, unknown>).meetingTime;
        return { meetingTime: pickKeys(mt, MEETING_TIME_KEYS) };
      })
      .filter(
        (m): m is { meetingTime: Record<string, unknown> | null } => m !== null,
      );
  }
  if (Array.isArray(top.sectionAttributes)) {
    top.sectionAttributes = (top.sectionAttributes as unknown[])
      .map((a) => pickKeys(a, ATTRIBUTE_KEYS))
      .filter((a): a is Record<string, unknown> => a !== null);
  }
  const sanitizedStatus = pickKeys(top.status, STATUS_KEYS);
  if (sanitizedStatus) top.status = sanitizedStatus;
  else delete top.status;
  return top;
}
