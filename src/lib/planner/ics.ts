/**
 * Build a .ics calendar file from the planner's currently displayed
 * meetings. One VEVENT per meeting row with a weekly RRULE bounded by
 * the section's `start_date` / `end_date` when available.
 *
 * The output is a single self-contained UTF-8 string suitable for
 * downloading as a file or pasting into a calendar app. Time zones
 * follow Wyoming's rules (`America/Denver`) and are emitted as
 * floating local times — most calendar apps interpret floating times
 * in the user's local zone, which is what students expect.
 */

import type { PlannerCatalogJson } from "./client/catalog-types";
import { bannerClockToMinutes } from "./banner-time";
import { resolveDisplayCrnsWithMemberMap } from "./resolve-display-crns-shared";
import {
  buildMembersByBundleId,
} from "./client/derive";
import type { PlannerItemRow } from "./data";

const DAY_FIELDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const ICAL_DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldLine(line: string): string {
  // RFC 5545 line folding: lines longer than 75 octets must be wrapped with
  // CRLF + space. We approximate with chars (good enough for ASCII content).
  if (line.length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    out.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return out.join("\r\n");
}

function fmtDateTime(dateStr: string, minutes: number): string {
  // dateStr is YYYY-MM-DD; minutes is minute-of-day. Emit floating local time.
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const compact = dateStr.replace(/-/g, "");
  return `${compact}T${pad2(h)}${pad2(m)}00`;
}

/** "2026-01-12" + offsetDays → "2026-01-19" (no DST math; calendar adds days). */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function dayIndexOf(dateStr: string): number {
  // Returns 0=Mon … 6=Sun for a YYYY-MM-DD string interpreted in UTC.
  const [y, m, d] = dateStr.split("-").map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return 0;
  const utc = new Date(Date.UTC(y, m - 1, d));
  // JS getUTCDay: Sun=0..Sat=6. Convert to Mon=0..Sun=6.
  return (utc.getUTCDay() + 6) % 7;
}

/**
 * Find the first occurrence on or after `startDate` whose weekday matches
 * `dayIndex` (0=Mon..6=Sun). Used to compute DTSTART for each meeting.
 */
function firstOccurrenceOnOrAfter(
  startDate: string,
  dayIndex: number,
): string {
  for (let i = 0; i < 7; i++) {
    const candidate = addDays(startDate, i);
    if (dayIndexOf(candidate) === dayIndex) return candidate;
  }
  return startDate;
}

/** Banner stores dates like "01/12/2026" or "2026-01-12". Normalize to ISO. */
function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const slash = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (slash) {
    const [, mm, dd, yyyy] = slash;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

export type IcsBuildInput = {
  termCode: string;
  items: PlannerItemRow[];
  catalog: PlannerCatalogJson;
};

/**
 * Build a .ics file body. The function is purely synchronous so it can run
 * in the browser; the caller wraps the result in a Blob and triggers a
 * download.
 */
export function buildIcsForPlannerWeek(input: IcsBuildInput): string {
  const { items, catalog, termCode } = input;
  const membersByBundleId = buildMembersByBundleId(catalog.linkedBundleMembers);
  const wantedCrns = new Set<string>();
  for (const item of items) {
    const crns = resolveDisplayCrnsWithMemberMap(
      {
        selectionKind: item.selectionKind,
        anchorCrn: item.anchorCrn,
        linkedBundleId: item.linkedBundleId,
      },
      membersByBundleId,
    );
    for (const c of crns) wantedCrns.add(c);
  }

  const sectionByCrn = new Map<string, (typeof catalog.sections)[number]>();
  for (const s of catalog.sections) sectionByCrn.set(s.crn, s);

  const itemByCrn = new Map<string, PlannerItemRow>();
  for (const item of items) {
    const crns = resolveDisplayCrnsWithMemberMap(
      {
        selectionKind: item.selectionKind,
        anchorCrn: item.anchorCrn,
        linkedBundleId: item.linkedBundleId,
      },
      membersByBundleId,
    );
    for (const c of crns) itemByCrn.set(c, item);
  }

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//uwyoschedule//planner//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(`X-WR-CALNAME:UW schedule ${termCode}`);

  const dtstamp = nowUtcStamp();

  let eventCount = 0;
  for (const m of catalog.meetings) {
    if (!wantedCrns.has(m.sectionCrn)) continue;
    const start = bannerClockToMinutes(m.beginTime);
    const end = bannerClockToMinutes(m.endTime);
    if (start == null || end == null || end <= start) continue;
    const dayBits = DAY_FIELDS.map((f) => Boolean(m[f]));
    const activeDays = dayBits
      .map((on, i) => (on ? i : -1))
      .filter((i) => i >= 0);
    if (activeDays.length === 0) continue;

    const startDate = normalizeDate(m.startDate);
    const endDate = normalizeDate(m.endDate);
    if (!startDate) continue;

    const section = sectionByCrn.get(m.sectionCrn);
    const item = itemByCrn.get(m.sectionCrn);
    const summaryBase = section?.subjectCourse
      ? section.subjectCourse
      : item
        ? `${item.subject} ${item.courseNumber}`
        : `CRN ${m.sectionCrn}`;
    const summary = section?.scheduleTypeDescription
      ? `${summaryBase} (${section.scheduleTypeDescription})`
      : summaryBase;
    const location = [m.buildingDescription ?? m.building, m.room]
      .filter(Boolean)
      .join(" ")
      .trim();
    const descriptionBits = [
      `CRN ${m.sectionCrn}`,
      catalog.facultyByCrn[m.sectionCrn]?.trim() || "",
    ].filter(Boolean);

    for (const dayIdx of activeDays) {
      const firstOcc = firstOccurrenceOnOrAfter(startDate, dayIdx);
      const dtstart = fmtDateTime(firstOcc, start);
      const dtend = fmtDateTime(firstOcc, end);
      const byday = ICAL_DAY_CODES[dayIdx];
      const untilDate = endDate ?? addDays(startDate, 7 * 16);
      const until = fmtDateTime(untilDate, 23 * 60 + 59);
      const uid = `planner-${termCode}-${m.sectionCrn}-${m.id}-${dayIdx}@uwyoschedule`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${dtstart}`);
      lines.push(`DTEND:${dtend}`);
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${byday};UNTIL=${until}`);
      lines.push(`SUMMARY:${escapeIcsText(summary)}`);
      if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
      if (descriptionBits.length > 0) {
        lines.push(
          `DESCRIPTION:${escapeIcsText(descriptionBits.join("\n"))}`,
        );
      }
      lines.push("END:VEVENT");
      eventCount += 1;
    }
  }

  lines.push("END:VCALENDAR");

  if (eventCount === 0) {
    // Still emit a valid (empty) calendar so the download isn't malformed.
  }

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function nowUtcStamp(): string {
  const dt = new Date();
  const yyyy = dt.getUTCFullYear();
  const mm = pad2(dt.getUTCMonth() + 1);
  const dd = pad2(dt.getUTCDate());
  const hh = pad2(dt.getUTCHours());
  const min = pad2(dt.getUTCMinutes());
  const ss = pad2(dt.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}
