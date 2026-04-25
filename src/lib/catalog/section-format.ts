import type { SearchResultsRow } from "@/lib/banner-ssb/types";

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

const DAY_KEYS: readonly [keyof DayFlags, string][] = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
];

type DayFlags = {
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
};

export function formatBannerTimeShort(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string" || !raw.length) return "";
  const d = raw.replace(/\D/g, "");
  if (!d.length) return raw;
  let h: number;
  let m: number;
  if (d.length <= 2) {
    h = parseInt(d, 10);
    m = 0;
  } else if (d.length === 3) {
    h = parseInt(d[0]!, 10);
    m = parseInt(d.slice(1), 10);
  } else {
    h = parseInt(d.slice(0, 2), 10);
    m = parseInt(d.slice(2, 4), 10);
  }
  if (Number.isNaN(h) || Number.isNaN(m)) return raw;
  h = ((h % 24) + 24) % 24;
  m = ((m % 60) + 60) % 60;
  const am = h < 12;
  const h12 = h % 12 || 12;
  const mm = m.toString().padStart(2, "0");
  return `${h12}:${mm} ${am ? "a.m." : "p.m."}`;
}

function weekdayPart(mt: DayFlags & Record<string, unknown>): string {
  const labels: string[] = [];
  for (const [k, lab] of DAY_KEYS) {
    if (mt[k] === true) labels.push(lab);
  }
  if (!labels.length) return "";
  return labels.join("/");
}

export function formatMeetingTimeLine(
  meetingTime: Record<string, unknown> | null | undefined
): string {
  if (!meetingTime) return "";
  const parts: string[] = [];
  const days = weekdayPart(
    meetingTime as DayFlags & Record<string, unknown>
  );
  if (days) parts.push(days);
  const begin = formatBannerTimeShort(
    typeof meetingTime.beginTime === "string"
      ? meetingTime.beginTime
      : undefined
  );
  const end = formatBannerTimeShort(
    typeof meetingTime.endTime === "string" ? meetingTime.endTime : undefined
  );
  if (begin && end) parts.push(`${begin}–${end}`);
  else if (begin) parts.push(begin);
  const bDesc =
    typeof meetingTime.buildingDescription === "string" &&
    meetingTime.buildingDescription
      ? meetingTime.buildingDescription
      : null;
  const bCode =
    typeof meetingTime.building === "string" && meetingTime.building
      ? meetingTime.building
      : null;
  const room =
    typeof meetingTime.room === "string" && meetingTime.room
      ? meetingTime.room
      : null;
  const place = [bDesc || bCode, room].filter(Boolean).join(" · ");
  if (place) parts.push(place);
  const mt =
    typeof meetingTime.meetingTypeDescription === "string" &&
    meetingTime.meetingTypeDescription;
  const ms =
    typeof meetingTime.meetingScheduleType === "string" &&
    meetingTime.meetingScheduleType;
  if (mt && mt !== "No Meeting") parts.push(mt);
  else if (ms) parts.push(ms);
  return parts.join(" · ");
}

export function formatMeetingLinesFromRow(
  row: SearchResultsRow | Record<string, unknown>
): string[] {
  const r = row as Record<string, unknown>;
  const raw = r.meetingsFaculty;
  if (!Array.isArray(raw) || !raw.length) return [];
  const out: string[] = [];
  for (const m of raw) {
    if (!isRecord(m)) continue;
    const mt = m.meetingTime;
    if (isRecord(mt)) {
      const line = formatMeetingTimeLine(mt);
      if (line) out.push(line);
    }
  }
  return out;
}

export function primaryFacultyName(
  row: SearchResultsRow | Record<string, unknown>
): string | null {
  const r = row as Record<string, unknown>;
  const fac = r.faculty;
  if (!Array.isArray(fac) || !fac.length) return null;
  const prim = fac.find(
    (f) => isRecord(f) && f.primaryIndicator === true
  ) as Record<string, unknown> | undefined;
  if (isRecord(prim) && typeof prim.displayName === "string")
    return prim.displayName;
  for (const f of fac) {
    if (isRecord(f) && typeof f.displayName === "string") return f.displayName;
  }
  return null;
}

export function formatFacultyNamesList(
  row: SearchResultsRow | Record<string, unknown>
): string[] {
  const r = row as Record<string, unknown>;
  const fac = r.faculty;
  if (!Array.isArray(fac) || !fac.length) return [];
  return fac
    .map((f) => (isRecord(f) && typeof f.displayName === "string" ? f.displayName : null))
    .filter((x): x is string => x != null && x.length > 0);
}

function strField(r: Record<string, unknown>, key: string): string {
  const v = r[key];
  if (v == null) return "";
  if (typeof v === "string" && v.length) return v;
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  return "";
}

/**
 * One flat string of searchable text for a section row (Banner search result shape).
 */
export function buildSearchText(row: SearchResultsRow | Record<string, unknown>): string {
  const r = isRecord(row) ? row : {};
  const chunks: string[] = [
    strField(r, "term"),
    strField(r, "termDesc"),
    strField(r, "courseReferenceNumber"),
    strField(r, "subject"),
    strField(r, "courseNumber"),
    strField(r, "courseDisplay"),
    strField(r, "subjectDescription"),
    strField(r, "courseTitle"),
    strField(r, "subjectCourse"),
    strField(r, "partOfTerm"),
    strField(r, "campusDescription"),
    strField(r, "sequenceNumber"),
    strField(r, "scheduleTypeDescription"),
    strField(r, "linkIdentifier"),
  ];
  for (const name of formatFacultyNamesList(r)) {
    chunks.push(name);
  }
  for (const line of formatMeetingLinesFromRow(r)) {
    chunks.push(line);
  }
  if (isRecord(r.meetingTime as unknown)) {
    const mt = r.meetingTime as Record<string, unknown>;
    for (const k of [
      "building",
      "room",
      "buildingDescription",
      "campusDescription",
    ] as const) {
      if (typeof mt[k] === "string") chunks.push(mt[k]);
    }
  }
  const mfac = r.meetingsFaculty;
  if (Array.isArray(mfac)) {
    for (const mf of mfac) {
      if (isRecord(mf) && isRecord(mf.meetingTime as unknown)) {
        const inner = mf.meetingTime as Record<string, unknown>;
        for (const k of [
          "building",
          "room",
          "buildingDescription",
        ] as const) {
          if (typeof inner[k] === "string") chunks.push(inner[k]);
        }
      }
    }
  }
  return chunks.filter((s) => s.length).join(" ");
}

export function buildSearchTextForCourse(
  courseKey: string,
  rows: SearchResultsRow[]
): string {
  const keyParts = courseKey.split("|");
  const base = [courseKey.replaceAll("|", " "), ...keyParts]
    .filter((s) => s.length)
    .join(" ");
  const fromRows = rows.map((row) => buildSearchText(row)).join(" ");
  return `${base} ${fromRows}`.replace(/\s+/g, " ").trim();
}

export function rowMatchesQuery(
  row: SearchResultsRow | Record<string, unknown>,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return buildSearchText(isRecord(row) ? row : {}).toLowerCase().includes(q);
}

/**
 * A course is shown if the query matches the course key / any section row.
 */
export function courseMatchesQuery(
  courseKey: string,
  rows: SearchResultsRow[],
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (buildSearchTextForCourse(courseKey, rows).toLowerCase().includes(q))
    return true;
  return false;
}

export function filterCourseEntries(
  courses: Map<string, SearchResultsRow[]>,
  query: string
): [string, SearchResultsRow[]][] {
  const q = query.trim();
  if (!q) return [...courses.entries()];
  const out: [string, SearchResultsRow[]][] = [];
  for (const [key, rows] of courses) {
    if (courseMatchesQuery(key, rows, q)) out.push([key, rows]);
  }
  return out;
}

export function formatSectionHeadline(
  row: SearchResultsRow | Record<string, unknown>
): string {
  const r = isRecord(row) ? row : {};
  const sub = strField(r, "subject");
  const num = strField(r, "courseNumber");
  const st = strField(r, "scheduleTypeDescription");
  const link = strField(r, "linkIdentifier");
  const sc = [sub, num].filter(Boolean).join(" ");
  return [sc, st, link].filter(Boolean).join(" · ");
}
