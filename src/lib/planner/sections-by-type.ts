import type { CourseSolvePack } from "./solve-schedules-core";
import { normalizeScheduleTypeKey } from "./swap-helpers";

export type SectionRowMeeting = {
  /** Day index 0=Mon … 6=Sun for compact display. */
  dayIndex: number;
  /** 24h "0850" begin / end strings from Banner. */
  begin: string;
  end: string;
};

export type SectionRow = {
  crn: string;
  /** Normalized schedule-type key. Used by `toggleSectionPin`. */
  scheduleTypeKey: string;
  /** Original schedule-type label ("Lecture", "Lab", "Discussion"). */
  scheduleTypeLabel: string;
  /** Banner sequence number ("01", "20") or null. */
  sequenceNumber: string | null;
  /** First instructor display name to show; null if none. */
  instructorDisplay: string | null;
  /** Open seats from `sections.seatsAvailable`; null when Banner didn't say. */
  seatsAvailable: number | null;
  /** True when the section reports zero or fewer open seats. */
  isFull: boolean;
  /** Meetings flattened for chip display. */
  meetings: SectionRowMeeting[];
  /** The Banner instructional-method description for the modality pill. */
  instructionalMethodDescription: string | null;
  instructionalMethod: string | null;
  /** Whether this section is a candidate's anchor (so it sits on the lecture row). */
  isAnchor: boolean;
};

export type SectionTypeGroup = {
  scheduleTypeKey: string;
  /** Best human label across the group's sections. */
  label: string;
  /** True for the group of anchor sections (typically lectures). */
  isAnchorGroup: boolean;
  rows: SectionRow[];
};

const DAY_FIELDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type CatalogShape = {
  sections: {
    crn: string;
    scheduleTypeDescription: string | null;
    sequenceNumber: string | null;
    instructionalMethod: string | null;
    instructionalMethodDescription: string | null;
    seatsAvailable: number | null;
  }[];
  meetings: {
    sectionCrn: string;
    beginTime: string | null;
    endTime: string | null;
    monday: boolean | null;
    tuesday: boolean | null;
    wednesday: boolean | null;
    thursday: boolean | null;
    friday: boolean | null;
    saturday: boolean | null;
    sunday: boolean | null;
  }[];
  facultyByCrn: Record<string, string>;
};

function meetingsForCrn(catalog: CatalogShape, crn: string): SectionRowMeeting[] {
  const rows = catalog.meetings.filter((m) => m.sectionCrn === crn);
  const out: SectionRowMeeting[] = [];
  for (const m of rows) {
    if (!m.beginTime || !m.endTime) continue;
    for (let i = 0; i < DAY_FIELDS.length; i++) {
      const field = DAY_FIELDS[i]!;
      if (m[field]) {
        out.push({ dayIndex: i, begin: m.beginTime, end: m.endTime });
      }
    }
  }
  out.sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return a.begin.localeCompare(b.begin);
  });
  return out;
}

/**
 * Group every CRN that appears in any solver candidate by schedule type and
 * produce per-section rows with the chip data the picker UI needs. Anchor
 * groups (the lecture, typically) are returned first; linked-bundle members
 * follow alphabetically by label.
 */
export function buildCourseSectionGroups(
  pack: CourseSolvePack,
  catalog: CatalogShape,
): SectionTypeGroup[] {
  const anchorCrns = new Set<string>();
  const linkedCrns = new Set<string>();
  for (const c of pack.candidates) {
    anchorCrns.add(c.anchorCrn);
    if (c.selectionKind === "linked_bundle") {
      for (const crn of c.crns) {
        if (crn !== c.anchorCrn) linkedCrns.add(crn);
      }
    }
  }

  const sectionByCrn = new Map<string, CatalogShape["sections"][number]>();
  for (const s of catalog.sections) sectionByCrn.set(s.crn, s);

  const facultyByCrn = pack.facultyByCrn ?? {};

  const buildRow = (crn: string, isAnchor: boolean): SectionRow | null => {
    const s = sectionByCrn.get(crn);
    if (!s) return null;
    const fac = facultyByCrn[crn] ?? [];
    const primary = fac.find((f) => f.primaryIndicator === true) ?? fac[0];
    const instructor = (primary?.displayName ?? "").trim();
    const labelRaw = (s.scheduleTypeDescription ?? "").trim();
    const seatsRaw = pack.seatsByCrn?.[crn]?.seatsAvailable ?? s.seatsAvailable;
    const seats =
      typeof seatsRaw === "number" && Number.isFinite(seatsRaw) ? seatsRaw : null;
    return {
      crn,
      scheduleTypeKey: normalizeScheduleTypeKey(s.scheduleTypeDescription),
      scheduleTypeLabel: labelRaw || "Section",
      sequenceNumber: s.sequenceNumber,
      instructorDisplay: instructor.length > 0 ? instructor : null,
      seatsAvailable: seats,
      isFull: seats != null && seats <= 0,
      meetings: meetingsForCrn(catalog, crn),
      instructionalMethodDescription: s.instructionalMethodDescription,
      instructionalMethod: s.instructionalMethod,
      isAnchor,
    };
  };

  const byKey = new Map<string, SectionTypeGroup>();
  const ensureGroup = (
    key: string,
    label: string,
    isAnchorGroup: boolean,
  ): SectionTypeGroup => {
    let g = byKey.get(key);
    if (!g) {
      g = { scheduleTypeKey: key, label: label || key, isAnchorGroup, rows: [] };
      byKey.set(key, g);
    } else if (!g.label && label) {
      g.label = label;
    }
    return g;
  };

  for (const crn of anchorCrns) {
    const row = buildRow(crn, true);
    if (!row) continue;
    const g = ensureGroup(row.scheduleTypeKey, row.scheduleTypeLabel, true);
    g.rows.push(row);
  }
  for (const crn of linkedCrns) {
    const row = buildRow(crn, false);
    if (!row) continue;
    const g = ensureGroup(row.scheduleTypeKey, row.scheduleTypeLabel, false);
    if (!g.rows.some((r) => r.crn === crn)) g.rows.push(row);
  }

  for (const g of byKey.values()) {
    g.rows.sort((a, b) => {
      const seq = (a.sequenceNumber ?? "").localeCompare(b.sequenceNumber ?? "");
      if (seq !== 0) return seq;
      return a.crn.localeCompare(b.crn);
    });
  }

  const groups = [...byKey.values()];
  groups.sort((a, b) => {
    if (a.isAnchorGroup !== b.isAnchorGroup) return a.isAnchorGroup ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return groups;
}

const DAY_LETTERS = ["M", "T", "W", "Th", "F", "Sa", "Su"];

/** Compress meetings into a label like "MWF · 9 a.m." or "TR · 10:30 a.m." */
export function summarizeMeetings(rows: SectionRowMeeting[]): string {
  if (rows.length === 0) return "Time TBA";
  const byTime = new Map<string, number[]>();
  for (const m of rows) {
    const key = `${m.begin}-${m.end}`;
    const days = byTime.get(key) ?? [];
    days.push(m.dayIndex);
    byTime.set(key, days);
  }
  const parts: string[] = [];
  for (const [timeKey, days] of byTime) {
    const [begin, end] = timeKey.split("-");
    if (!begin || !end) continue;
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    const dayStr = sorted.map((i) => DAY_LETTERS[i] ?? "").join("");
    parts.push(`${dayStr} · ${formatBannerClock(begin)}\u2013${formatBannerClock(end)}`);
  }
  return parts.join("  ·  ");
}

function formatBannerClock(banner: string): string {
  if (banner.length !== 4) return banner;
  const h = Number(banner.slice(0, 2));
  const m = Number(banner.slice(2));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return banner;
  const period = h >= 12 ? "p.m." : "a.m.";
  const hh = ((h + 11) % 12) + 1;
  return m === 0 ? `${hh} ${period}` : `${hh}:${String(m).padStart(2, "0")} ${period}`;
}
