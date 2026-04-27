import type { InferInsertModel } from "drizzle-orm";
import type {
  sectionAttributes,
  sectionFaculty,
  sectionMeetings,
  sections,
} from "@/db/schema";
import { decodeHtmlEntities } from "@/lib/text/decodeHtmlEntities";
import type {
  BannerMeetingFaculty,
  BannerSectionAttribute,
  BannerSectionRow,
  LinkedSectionsResponse,
} from "./types";

type NewSection = InferInsertModel<typeof sections>;
type NewMeeting = InferInsertModel<typeof sectionMeetings>;
type NewFaculty = InferInsertModel<typeof sectionFaculty>;
type NewAttribute = InferInsertModel<typeof sectionAttributes>;
export type SectionGraph = {
  section: NewSection;
  meetings: NewMeeting[];
  faculty: NewFaculty[];
  attributes: NewAttribute[];
};

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return null;
}

function bool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  return null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return String(v);
}

/** Coerce to string, then decode HTML entities (Banner prose fields). */
function dstr(v: unknown): string | null {
  return decodeHtmlEntities(str(v));
}

/** Map one Banner section row + term into Drizzle insert shapes. */
export function mapSectionRowToGraph(
  termCode: string,
  row: BannerSectionRow,
): SectionGraph | null {
  const crn = str(row.courseReferenceNumber);
  const subject = str(row.subject);
  const courseNumber = str(row.courseNumber);
  if (!crn || !subject || !courseNumber) {
    return null;
  }

  const open =
    bool(row.openSection) ??
    bool(
      row.status &&
        typeof row.status === "object" &&
        "sectionOpen" in row.status
        ? (row.status as { sectionOpen?: boolean }).sectionOpen
        : undefined,
    );

  const section: NewSection = {
    termCode,
    crn,
    subject,
    courseNumber,
    sequenceNumber: dstr(row.sequenceNumber),
    subjectDescription: dstr(row.subjectDescription),
    courseTitle: dstr(row.courseTitle),
    subjectCourse: dstr(row.subjectCourse),
    scheduleTypeDescription: dstr(row.scheduleTypeDescription),
    partOfTerm: dstr(row.partOfTerm),
    campusDescription: dstr(row.campusDescription),
    instructionalMethod: dstr(row.instructionalMethod),
    instructionalMethodDescription: dstr(row.instructionalMethodDescription),
    creditHours: num(row.creditHours),
    creditHourHigh: num(row.creditHourHigh),
    creditHourLow: num(row.creditHourLow),
    creditHourIndicator: dstr(row.creditHourIndicator),
    enrollment: num(row.enrollment),
    maximumEnrollment: num(row.maximumEnrollment),
    seatsAvailable: num(row.seatsAvailable),
    waitCapacity: num(row.waitCapacity),
    waitCount: num(row.waitCount),
    waitAvailable: num(row.waitAvailable),
    openSection: open,
    crossList: dstr(row.crossList),
    crossListCapacity: num(row.crossListCapacity),
    crossListCount: num(row.crossListCount),
    crossListAvailable: num(row.crossListAvailable),
    linkIdentifier: dstr(row.linkIdentifier),
    isSectionLinked: bool(row.isSectionLinked),
    bannerRowId: typeof row.id === "number" ? row.id : null,
    rawJson: row as object,
  };

  const meetings: NewMeeting[] = [];
  const mf = row.meetingsFaculty;
  if (Array.isArray(mf)) {
    mf.forEach((block: BannerMeetingFaculty, idx: number) => {
      const mt = block.meetingTime;
      if (!mt || typeof mt !== "object") return;
      meetings.push({
        termCode,
        sectionCrn: crn,
        sortOrder: idx,
        beginTime: dstr(mt.beginTime),
        endTime: dstr(mt.endTime),
        monday: bool(mt.monday),
        tuesday: bool(mt.tuesday),
        wednesday: bool(mt.wednesday),
        thursday: bool(mt.thursday),
        friday: bool(mt.friday),
        saturday: bool(mt.saturday),
        sunday: bool(mt.sunday),
        building: dstr(mt.building),
        buildingDescription: dstr(mt.buildingDescription),
        room: dstr(mt.room),
        campus: dstr(mt.campus),
        campusDescription: dstr(mt.campusDescription),
        startDate: dstr(mt.startDate),
        endDate: dstr(mt.endDate),
        meetingScheduleType: dstr(mt.meetingScheduleType),
        meetingType: dstr(mt.meetingType),
        meetingTypeDescription: dstr(mt.meetingTypeDescription),
        hoursWeek: num(mt.hoursWeek),
        creditHourSession: num(mt.creditHourSession),
        category: dstr(block.category),
        rawJson: block as object,
      });
    });
  }

  const faculty: NewFaculty[] = [];
  if (Array.isArray(row.faculty)) {
    row.faculty.forEach((f, idx) => {
      if (!f || typeof f !== "object") return;
      faculty.push({
        termCode,
        sectionCrn: crn,
        sortOrder: idx,
        bannerId: str(f.bannerId),
        displayName: dstr(f.displayName),
        emailAddress: dstr(f.emailAddress),
        primaryIndicator: bool(f.primaryIndicator),
        rawJson: f as object,
      });
    });
  }

  const attributes: NewAttribute[] = [];
  if (Array.isArray(row.sectionAttributes)) {
    row.sectionAttributes.forEach((a: BannerSectionAttribute) => {
      if (!a?.code) return;
      attributes.push({
        termCode,
        sectionCrn: crn,
        code: a.code,
        description: dstr(a.description),
        isZtcAttribute: bool(a.isZTCAttribute),
        rawJson: a as object,
      });
    });
  }

  return { section, meetings, faculty, attributes };
}

export function courseKey(subject: string, courseNumber: string): string {
  return `${subject}\0${courseNumber}`;
}

function isLectureLikeScheduleRow(r: BannerSectionRow): boolean {
  const d = decodeHtmlEntities(str(r.scheduleTypeDescription))?.toLowerCase() ?? "";
  return d.includes("lecture") || d === "lec" || d.includes("lec ");
}

/** Prefer lecture-like row as anchor for `fetchLinkedSections`; else lexicographically smallest CRN. */
export function pickLinkedAnchorCrn(rows: BannerSectionRow[]): string | null {
  const withCrn = rows
    .map((r) => str(r.courseReferenceNumber))
    .filter((c): c is string => Boolean(c));
  if (withCrn.length === 0) return null;

  const lectureish = rows.find((r) => isLectureLikeScheduleRow(r));
  const anchorFromLecture = str(lectureish?.courseReferenceNumber);
  if (anchorFromLecture) return anchorFromLecture;

  return [...withCrn].sort()[0] ?? null;
}

/**
 * Every CRN that should receive its own `fetchLinkedSections` call for this course group.
 * Banner returns linked options keyed by the lecture (or primary) anchor the student picks.
 */
export function linkedFetchAnchorCrns(rows: BannerSectionRow[]): string[] {
  const lectureCrns = new Set<string>();
  for (const r of rows) {
    if (!isLectureLikeScheduleRow(r)) continue;
    const c = str(r.courseReferenceNumber);
    if (c) lectureCrns.add(c);
  }
  if (lectureCrns.size > 0) {
    return [...lectureCrns].sort();
  }
  const single = pickLinkedAnchorCrn(rows);
  return single ? [single] : [];
}

export type ParsedLinkedBundle = {
  anchorCrn: string;
  bundleIndex: number;
  memberCrns: string[];
};

/** Parse `linkedData`: outer OR, inner AND; variable inner length. */
export function parseLinkedData(
  anchorCrn: string,
  payload: LinkedSectionsResponse,
): ParsedLinkedBundle[] {
  const raw = payload.linkedData;
  if (!Array.isArray(raw)) return [];

  const out: ParsedLinkedBundle[] = [];
  raw.forEach((bundle, bundleIndex) => {
    if (!Array.isArray(bundle)) return;
    const memberCrns = bundle
      .map((row) => str((row as BannerSectionRow).courseReferenceNumber))
      .filter((c): c is string => Boolean(c));
    if (memberCrns.length === 0) return;
    out.push({ anchorCrn, bundleIndex, memberCrns });
  });
  return out;
}
