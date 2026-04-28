import { bannerClockToMinutes } from "../banner-time";
import {
  CALENDAR_HOUR_COUNT,
  CALENDAR_START_HOUR,
} from "../constants";
import type { CalendarBlock, PlannerItemRow, SwapGhostMeeting } from "../data";
import {
  normalizeMeetingScheduleType,
  normalizeScheduleTypeKey,
} from "../swap-helpers";
import type {
  ClientCatalogSection,
  ClientLinkedBundleMemberRow,
  ClientLinkedBundleRow,
  PlannerCatalogJson,
} from "./catalog-types";
import type {
  PlannerItemSelection,
  ResolvedPlannerSelection,
} from "../resolve-display-crns-shared";
import { resolveDisplayCrnsWithMemberMap } from "../resolve-display-crns-shared";

const DAY_FIELDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function dayIndexForField(
  field: (typeof DAY_FIELDS)[number],
): number | null {
  const i = DAY_FIELDS.indexOf(field);
  return i >= 0 ? i : null;
}

function sectionLabel(s: ClientCatalogSection): string {
  const code = s.subjectCourse ?? "";
  const seq = s.sequenceNumber ? ` #${s.sequenceNumber}` : "";
  const st = s.scheduleTypeDescription ?? "";
  return [code + seq, st].filter(Boolean).join(" — ") || `CRN ${s.crn}`;
}

export function buildMembersByBundleId(
  rows: ClientLinkedBundleMemberRow[],
): Map<number, string[]> {
  const m = new Map<number, string[]>();
  for (const r of rows) {
    const list = m.get(r.bundleId) ?? [];
    list.push(r.crn);
    m.set(r.bundleId, list);
  }
  return m;
}

export function resolveItemDisplayCrns(
  item: PlannerItemRow,
  membersByBundleId: Map<number, string[]>,
): string[] {
  const sel: PlannerItemSelection = {
    selectionKind: item.selectionKind,
    anchorCrn: item.anchorCrn,
    linkedBundleId: item.linkedBundleId,
  };
  return resolveDisplayCrnsWithMemberMap(sel, membersByBundleId);
}

/** Unique CRNs for the current item selections (registration order follows `items`). */
export function collectDisplayCrnsForItems(
  items: PlannerItemRow[],
  catalog: PlannerCatalogJson,
): string[] {
  if (items.length === 0) return [];
  const membersByBundleId = buildMembersByBundleId(catalog.linkedBundleMembers);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    for (const crn of resolveItemDisplayCrns(item, membersByBundleId)) {
      if (!seen.has(crn)) {
        seen.add(crn);
        out.push(crn);
      }
    }
  }
  return out;
}

export function buildCalendarBlocksFromCatalog(
  items: PlannerItemRow[],
  catalog: PlannerCatalogJson,
): CalendarBlock[] {
  if (items.length === 0) return [];

  const membersByBundleId = buildMembersByBundleId(catalog.linkedBundleMembers);
  const crnsByItemId = new Map<number, string[]>();
  const allCrns = new Set<string>();
  for (const item of items) {
    const crns = resolveItemDisplayCrns(item, membersByBundleId);
    crnsByItemId.set(item.id, crns);
    crns.forEach((c) => allCrns.add(c));
  }

  const sectionByCrn = new Map<string, ClientCatalogSection>();
  for (const s of catalog.sections) sectionByCrn.set(s.crn, s);

  const scheduleTypeByCrn = new Map<string, string | null>();
  for (const s of catalog.sections) {
    scheduleTypeByCrn.set(s.crn, s.scheduleTypeDescription);
  }

  const sectionTitles = new Map<string, string>();
  for (const s of catalog.sections) {
    sectionTitles.set(s.crn, sectionLabel(s));
  }

  const windowStart = CALENDAR_START_HOUR * 60;
  const windowEnd = windowStart + CALENDAR_HOUR_COUNT * 60;

  const blocks: CalendarBlock[] = [];
  for (const item of items) {
    const itemCrns = new Set(crnsByItemId.get(item.id) ?? []);
    const label = `${item.subject} ${item.courseNumber}`;

    for (const m of catalog.meetings) {
      if (!itemCrns.has(m.sectionCrn)) continue;
      const start = bannerClockToMinutes(m.beginTime);
      const end = bannerClockToMinutes(m.endTime);
      if (start == null || end == null || end <= start) continue;

      const clipStart = Math.max(start, windowStart);
      const clipEnd = Math.min(end, windowEnd);
      if (clipEnd <= clipStart) continue;

      const buildingShort = m.buildingDescription ?? m.building ?? null;
      const sub =
        [buildingShort, m.room].filter(Boolean).join(" ") ||
        "";
      const facultyRaw =
        catalog.facultyByCrn[m.sectionCrn]?.trim() ?? "";
      const instructorSublabel =
        facultyRaw.length > 0 ? facultyRaw : null;
      const sectionRow = sectionByCrn.get(m.sectionCrn) ?? null;
      const seatsAvailable = sectionRow?.seatsAvailable ?? null;

      for (const field of DAY_FIELDS) {
        if (!m[field]) continue;
        const dayIndex = dayIndexForField(field);
        if (dayIndex == null) continue;
        blocks.push({
          key: `${item.id}-${m.id}-${field}`,
          plannerItemId: item.id,
          sectionCrn: m.sectionCrn,
          meetingId: m.id,
          dayIndex,
          startMinutes: clipStart,
          endMinutes: clipEnd,
          label: sectionTitles.get(m.sectionCrn) ?? label,
          sublabel: sub,
          instructorSublabel,
          seatsAvailable,
          buildingShort,
          color: item.displayColor,
          subject: item.subject,
          courseNumber: item.courseNumber,
          sectionScheduleTypeKey: normalizeScheduleTypeKey(
            scheduleTypeByCrn.get(m.sectionCrn) ?? null,
          ),
          meetingScheduleType: m.meetingScheduleType ?? null,
        });
      }
    }
  }

  return blocks;
}

export function listSameTypeSwapGhostsFromCatalog(
  catalog: PlannerCatalogJson,
  params: {
    subject: string;
    courseNumber: string;
    excludeSectionCrn: string;
    sourceScheduleTypeKey: string;
    sourceMeetingScheduleType: string | null;
  },
): SwapGhostMeeting[] {
  const typeKey = params.sourceScheduleTypeKey;
  if (typeKey.length === 0) return [];

  const sourceMt = normalizeMeetingScheduleType(
    params.sourceMeetingScheduleType,
  );

  const candidateCrns = catalog.sections
    .filter(
      (s) =>
        s.subject === params.subject &&
        s.courseNumber === params.courseNumber &&
        s.crn !== params.excludeSectionCrn &&
        normalizeScheduleTypeKey(s.scheduleTypeDescription) === typeKey,
    )
    .map((s) => s.crn);

  if (candidateCrns.length === 0) return [];
  const candSet = new Set(candidateCrns);

  const windowStart = CALENDAR_START_HOUR * 60;
  const windowEnd = windowStart + CALENDAR_HOUR_COUNT * 60;
  const ghosts: SwapGhostMeeting[] = [];

  for (const m of catalog.meetings) {
    if (!candSet.has(m.sectionCrn)) continue;
    if (sourceMt != null) {
      const mt = normalizeMeetingScheduleType(m.meetingScheduleType);
      if (mt !== sourceMt) continue;
    }
    const start = bannerClockToMinutes(m.beginTime);
    const end = bannerClockToMinutes(m.endTime);
    if (start == null || end == null || end <= start) continue;

    const clipStart = Math.max(start, windowStart);
    const clipEnd = Math.min(end, windowEnd);
    if (clipEnd <= clipStart) continue;

    for (const field of DAY_FIELDS) {
      if (!m[field]) continue;
      const dayIndex = dayIndexForField(field);
      if (dayIndex == null) continue;
      ghosts.push({
        crn: m.sectionCrn,
        meetingId: m.id,
        dayIndex,
        startMinutes: clipStart,
        endMinutes: clipEnd,
      });
    }
  }

  return ghosts;
}

function findLinkedBundlesContainingCrnClient(
  crn: string,
  bundles: ClientLinkedBundleRow[],
  members: ClientLinkedBundleMemberRow[],
): ClientLinkedBundleRow[] {
  const byId = new Map<number, ClientLinkedBundleRow>();
  for (const b of bundles) {
    if (b.anchorCrn === crn) byId.set(b.id, b);
  }
  const memberBundleIds = new Set<number>();
  for (const m of members) {
    if (m.crn === crn) memberBundleIds.add(m.bundleId);
  }
  for (const b of bundles) {
    if (memberBundleIds.has(b.id)) byId.set(b.id, b);
  }
  return [...byId.values()].sort((a, b) => {
    if (a.anchorCrn !== b.anchorCrn) return a.anchorCrn.localeCompare(b.anchorCrn);
    return a.bundleIndex - b.bundleIndex;
  });
}

export function resolvePlannerSwapClient(
  item: PlannerItemRow,
  params: {
    targetCrn: string;
    sourceSectionCrn: string;
    sourceMeetingId: number;
  },
  catalog: PlannerCatalogJson,
): { ok: false; error: string } | ({ ok: true } & ResolvedPlannerSelection) {
  const meeting = catalog.meetings.find(
    (m) =>
      m.sectionCrn === params.sourceSectionCrn && m.id === params.sourceMeetingId,
  );
  const section = catalog.sections.find((s) => s.crn === params.sourceSectionCrn);
  if (!meeting || !section) {
    return { ok: false, error: "Meeting not found." };
  }
  if (
    section.subject !== item.subject ||
    section.courseNumber !== item.courseNumber
  ) {
    return { ok: false, error: "Meeting does not match this planner course." };
  }

  const typeKey = normalizeScheduleTypeKey(section.scheduleTypeDescription);
  const ghosts = listSameTypeSwapGhostsFromCatalog(catalog, {
    subject: item.subject,
    courseNumber: item.courseNumber,
    excludeSectionCrn: params.sourceSectionCrn,
    sourceScheduleTypeKey: typeKey,
    sourceMeetingScheduleType: meeting.meetingScheduleType ?? null,
  });

  if (!ghosts.some((g) => g.crn === params.targetCrn)) {
    return {
      ok: false,
      error: "That section is not a same-type alternative for this block.",
    };
  }

  const bundled = findLinkedBundlesContainingCrnClient(
    params.targetCrn,
    catalog.linkedBundles,
    catalog.linkedBundleMembers,
  );

  if (bundled.length === 0) {
    return {
      ok: true,
      selectionKind: "single_crn",
      anchorCrn: params.targetCrn,
      linkedBundleId: null,
    };
  }

  const membersByBundleId = buildMembersByBundleId(catalog.linkedBundleMembers);
  const currentCrns = resolveItemDisplayCrns(item, membersByBundleId);

  let best: {
    bundleId: number;
    anchorCrn: string;
    bundleIndex: number;
    score: number;
  } | null = null;

  for (const b of bundled) {
    const mems = membersByBundleId.get(b.id) ?? [];
    const full = new Set<string>([b.anchorCrn, ...mems]);
    let score = 0;
    for (const c of currentCrns) {
      if (full.has(c)) score++;
    }
    if (
      !best ||
      score > best.score ||
      (score === best.score && b.bundleIndex < best.bundleIndex)
    ) {
      best = {
        bundleId: b.id,
        anchorCrn: b.anchorCrn,
        bundleIndex: b.bundleIndex,
        score,
      };
    }
  }

  if (!best) {
    return { ok: false, error: "Could not resolve linked registration." };
  }

  return {
    ok: true,
    selectionKind: "linked_bundle",
    anchorCrn: best.anchorCrn,
    linkedBundleId: best.bundleId,
  };
}
