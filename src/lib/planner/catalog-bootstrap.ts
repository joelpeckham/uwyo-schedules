import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { decodeHtmlEntities } from "@/lib/text/decodeHtmlEntities";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import type { PlannerCatalogJson } from "./client/catalog-types";
import type { PlannerItemRow } from "./data";
import {
  ensureSectionDescriptions,
  loadSectionInformationByCrn,
} from "./ensure-section-descriptions";
import {
  loadOrderedMembersForBundleIds,
  type PlannerItemSelection,
  resolveDisplayCrnsWithMemberMap,
} from "./resolve-display-crns";
import { parseExamReservations } from "@/lib/sections/parse-exam-reservations";

const EMPTY_CATALOG: PlannerCatalogJson = {
  sections: [],
  meetings: [],
  linkedBundles: [],
  linkedBundleMembers: [],
  facultyByCrn: {},
  examReservationsByCrn: {},
  vagueExamNoteByCrn: {},
};

type SectionRow = {
  crn: string;
  subject: string;
  courseNumber: string;
  scheduleTypeDescription: string | null;
  sequenceNumber: string | null;
  subjectCourse: string | null;
  courseTitle: string | null;
  instructionalMethod: string | null;
  instructionalMethodDescription: string | null;
  creditHours: number | null;
  creditHourLow: number | null;
  creditHourHigh: number | null;
  creditHourIndicator: string | null;
  seatsAvailable: number | null;
};

function decodeSectionRow(r: SectionRow): SectionRow {
  return {
    ...r,
    scheduleTypeDescription: decodeHtmlEntities(r.scheduleTypeDescription),
    sequenceNumber: decodeHtmlEntities(r.sequenceNumber),
    subjectCourse: decodeHtmlEntities(r.subjectCourse),
    courseTitle: decodeHtmlEntities(r.courseTitle),
    instructionalMethod: decodeHtmlEntities(r.instructionalMethod),
    instructionalMethodDescription: decodeHtmlEntities(
      r.instructionalMethodDescription,
    ),
  };
}

/** All CRNs tied to planner items (display selections + course sections + bundle members). */
async function resolvePlannerCatalogAllCrns(
  db: Database,
  termCode: string,
  plannerItems: PlannerItemRow[],
): Promise<string[]> {
  if (plannerItems.length === 0) return [];

  const bundleIds = [
    ...new Set(
      plannerItems
        .map((i) => i.linkedBundleId)
        .filter((id): id is number => id != null),
    ),
  ];
  const membersByBundleId = await loadOrderedMembersForBundleIds(
    db,
    bundleIds,
  );

  const displayCrns = new Set<string>();
  for (const item of plannerItems) {
    const sel: PlannerItemSelection = {
      selectionKind: item.selectionKind,
      anchorCrn: item.anchorCrn,
      linkedBundleId: item.linkedBundleId,
    };
    const crns = resolveDisplayCrnsWithMemberMap(sel, membersByBundleId);
    crns.forEach((c) => displayCrns.add(c));
  }

  const coursePairs = new Map<string, { subject: string; courseNumber: string }>();
  for (const item of plannerItems) {
    const k = `${item.subject}\0${item.courseNumber}`;
    coursePairs.set(k, { subject: item.subject, courseNumber: item.courseNumber });
  }

  const pairList = [...coursePairs.values()];
  const sectionRows =
    pairList.length === 0
      ? []
      : await db
          .select({
            crn: schema.sections.crn,
            subject: schema.sections.subject,
            courseNumber: schema.sections.courseNumber,
            scheduleTypeDescription: schema.sections.scheduleTypeDescription,
            sequenceNumber: schema.sections.sequenceNumber,
            subjectCourse: schema.sections.subjectCourse,
            courseTitle: schema.sections.courseTitle,
            instructionalMethod: schema.sections.instructionalMethod,
            instructionalMethodDescription:
              schema.sections.instructionalMethodDescription,
            creditHours: schema.sections.creditHours,
            creditHourLow: schema.sections.creditHourLow,
            creditHourHigh: schema.sections.creditHourHigh,
            creditHourIndicator: schema.sections.creditHourIndicator,
            seatsAvailable: schema.sections.seatsAvailable,
          })
          .from(schema.sections)
          .where(
            and(
              eq(schema.sections.termCode, termCode),
              or(
                ...pairList.map((p) =>
                  and(
                    eq(schema.sections.subject, p.subject),
                    eq(schema.sections.courseNumber, p.courseNumber),
                  ),
                ),
              ),
            ),
          );

  const courseSectionCrns = new Set(sectionRows.map((r) => r.crn));
  const allCrns = new Set<string>([...displayCrns, ...courseSectionCrns]);
  const crnListForBundles = [...allCrns];

  const [anchoredBundles, memberBundleHits] =
    crnListForBundles.length === 0
      ? [
          [] as {
            id: number;
            anchorCrn: string;
            bundleIndex: number;
          }[],
          [] as {
            id: number;
            anchorCrn: string;
            bundleIndex: number;
          }[],
        ]
      : await Promise.all([
          db
            .select({
              id: schema.linkedBundles.id,
              anchorCrn: schema.linkedBundles.anchorCrn,
              bundleIndex: schema.linkedBundles.bundleIndex,
            })
            .from(schema.linkedBundles)
            .where(
              and(
                eq(schema.linkedBundles.termCode, termCode),
                inArray(schema.linkedBundles.anchorCrn, crnListForBundles),
              ),
            ),
          db
            .select({
              id: schema.linkedBundles.id,
              anchorCrn: schema.linkedBundles.anchorCrn,
              bundleIndex: schema.linkedBundles.bundleIndex,
            })
            .from(schema.linkedBundleMembers)
            .innerJoin(
              schema.linkedBundles,
              eq(schema.linkedBundles.id, schema.linkedBundleMembers.bundleId),
            )
            .where(
              and(
                eq(schema.linkedBundles.termCode, termCode),
                inArray(schema.linkedBundleMembers.crn, crnListForBundles),
              ),
            ),
        ]);

  const bundleMeta = new Map<
    number,
    { id: number; anchorCrn: string; bundleIndex: number }
  >();
  for (const b of [...anchoredBundles, ...memberBundleHits]) {
    bundleMeta.set(b.id, b);
  }

  const linkedBundles = [...bundleMeta.values()].sort((a, b) => {
    if (a.anchorCrn !== b.anchorCrn) return a.anchorCrn.localeCompare(b.anchorCrn);
    return a.bundleIndex - b.bundleIndex;
  });

  const linkedBundleIds = linkedBundles.map((b) => b.id);
  const linkedBundleMembers =
    linkedBundleIds.length === 0
      ? []
      : await db
          .select({
            bundleId: schema.linkedBundleMembers.bundleId,
            crn: schema.linkedBundleMembers.crn,
            position: schema.linkedBundleMembers.position,
          })
          .from(schema.linkedBundleMembers)
          .where(inArray(schema.linkedBundleMembers.bundleId, linkedBundleIds))
          .orderBy(
            schema.linkedBundleMembers.bundleId,
            asc(schema.linkedBundleMembers.position),
          );

  for (const m of linkedBundleMembers) {
    allCrns.add(m.crn);
  }

  return [...allCrns];
}

type PlannerCatalogExamEnrichment = Pick<
  PlannerCatalogJson,
  "examReservationsByCrn" | "vagueExamNoteByCrn"
>;

/**
 * Fast catalog slice for calendar blocks and swap ghosts (no external Banner
 * fetches or exam parsing).
 */
export async function loadPlannerCatalogCore(
  db: Database,
  termCode: string,
  plannerItems: PlannerItemRow[],
): Promise<{ catalog: PlannerCatalogJson }> {
  if (plannerItems.length === 0) {
    return { catalog: EMPTY_CATALOG };
  }

  const bundleIds = [
    ...new Set(
      plannerItems
        .map((i) => i.linkedBundleId)
        .filter((id): id is number => id != null),
    ),
  ];
  const membersByBundleId = await loadOrderedMembersForBundleIds(
    db,
    bundleIds,
  );

  const displayCrns = new Set<string>();
  for (const item of plannerItems) {
    const sel: PlannerItemSelection = {
      selectionKind: item.selectionKind,
      anchorCrn: item.anchorCrn,
      linkedBundleId: item.linkedBundleId,
    };
    const crns = resolveDisplayCrnsWithMemberMap(sel, membersByBundleId);
    crns.forEach((c) => displayCrns.add(c));
  }

  const coursePairs = new Map<string, { subject: string; courseNumber: string }>();
  for (const item of plannerItems) {
    const k = `${item.subject}\0${item.courseNumber}`;
    coursePairs.set(k, { subject: item.subject, courseNumber: item.courseNumber });
  }

  const pairList = [...coursePairs.values()];
  const sectionRows = await db
    .select({
      crn: schema.sections.crn,
      subject: schema.sections.subject,
      courseNumber: schema.sections.courseNumber,
      scheduleTypeDescription: schema.sections.scheduleTypeDescription,
      sequenceNumber: schema.sections.sequenceNumber,
      subjectCourse: schema.sections.subjectCourse,
      courseTitle: schema.sections.courseTitle,
      instructionalMethod: schema.sections.instructionalMethod,
      instructionalMethodDescription:
        schema.sections.instructionalMethodDescription,
      creditHours: schema.sections.creditHours,
      creditHourLow: schema.sections.creditHourLow,
      creditHourHigh: schema.sections.creditHourHigh,
      creditHourIndicator: schema.sections.creditHourIndicator,
      seatsAvailable: schema.sections.seatsAvailable,
    })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.termCode, termCode),
        or(
          ...pairList.map((p) =>
            and(
              eq(schema.sections.subject, p.subject),
              eq(schema.sections.courseNumber, p.courseNumber),
            ),
          ),
        ),
      ),
    );

  const sectionByCrn = new Map<string, SectionRow>();
  for (const r of sectionRows) {
    sectionByCrn.set(r.crn, decodeSectionRow(r));
  }

  const courseSectionCrns = new Set(sectionRows.map((r) => r.crn));
  const allCrns = new Set<string>([...displayCrns, ...courseSectionCrns]);
  const crnListForBundles = [...allCrns];

  const [anchoredBundles, memberBundleHits] =
    crnListForBundles.length === 0
      ? [
          [] as {
            id: number;
            anchorCrn: string;
            bundleIndex: number;
          }[],
          [] as {
            id: number;
            anchorCrn: string;
            bundleIndex: number;
          }[],
        ]
      : await Promise.all([
          db
            .select({
              id: schema.linkedBundles.id,
              anchorCrn: schema.linkedBundles.anchorCrn,
              bundleIndex: schema.linkedBundles.bundleIndex,
            })
            .from(schema.linkedBundles)
            .where(
              and(
                eq(schema.linkedBundles.termCode, termCode),
                inArray(schema.linkedBundles.anchorCrn, crnListForBundles),
              ),
            ),
          db
            .select({
              id: schema.linkedBundles.id,
              anchorCrn: schema.linkedBundles.anchorCrn,
              bundleIndex: schema.linkedBundles.bundleIndex,
            })
            .from(schema.linkedBundleMembers)
            .innerJoin(
              schema.linkedBundles,
              eq(schema.linkedBundles.id, schema.linkedBundleMembers.bundleId),
            )
            .where(
              and(
                eq(schema.linkedBundles.termCode, termCode),
                inArray(schema.linkedBundleMembers.crn, crnListForBundles),
              ),
            ),
        ]);

  const bundleMeta = new Map<
    number,
    { id: number; anchorCrn: string; bundleIndex: number }
  >();
  for (const b of [...anchoredBundles, ...memberBundleHits]) {
    bundleMeta.set(b.id, b);
  }

  const linkedBundles = [...bundleMeta.values()].sort((a, b) => {
    if (a.anchorCrn !== b.anchorCrn) return a.anchorCrn.localeCompare(b.anchorCrn);
    return a.bundleIndex - b.bundleIndex;
  });

  const linkedBundleIds = linkedBundles.map((b) => b.id);
  const linkedBundleMembers =
    linkedBundleIds.length === 0
      ? []
      : await db
          .select({
            bundleId: schema.linkedBundleMembers.bundleId,
            crn: schema.linkedBundleMembers.crn,
            position: schema.linkedBundleMembers.position,
          })
          .from(schema.linkedBundleMembers)
          .where(inArray(schema.linkedBundleMembers.bundleId, linkedBundleIds))
          .orderBy(
            schema.linkedBundleMembers.bundleId,
            asc(schema.linkedBundleMembers.position),
          );

  for (const m of linkedBundleMembers) {
    allCrns.add(m.crn);
  }

  const missingSectionCrns = [...allCrns].filter((c) => !sectionByCrn.has(c));
  if (missingSectionCrns.length > 0) {
    const extra = await db
      .select({
        crn: schema.sections.crn,
        subject: schema.sections.subject,
        courseNumber: schema.sections.courseNumber,
        scheduleTypeDescription: schema.sections.scheduleTypeDescription,
        sequenceNumber: schema.sections.sequenceNumber,
        subjectCourse: schema.sections.subjectCourse,
        courseTitle: schema.sections.courseTitle,
        instructionalMethod: schema.sections.instructionalMethod,
        instructionalMethodDescription:
          schema.sections.instructionalMethodDescription,
        creditHours: schema.sections.creditHours,
        creditHourLow: schema.sections.creditHourLow,
        creditHourHigh: schema.sections.creditHourHigh,
        creditHourIndicator: schema.sections.creditHourIndicator,
        seatsAvailable: schema.sections.seatsAvailable,
      })
      .from(schema.sections)
      .where(
        and(
          eq(schema.sections.termCode, termCode),
          inArray(schema.sections.crn, missingSectionCrns),
        ),
      );
    for (const r of extra) {
      sectionByCrn.set(r.crn, decodeSectionRow(r));
    }
  }

  const meetingCrnList = [...sectionByCrn.keys()];
  type MeetingRow = {
    id: number;
    sectionCrn: string;
    beginTime: string | null;
    endTime: string | null;
    meetingScheduleType: string | null;
    monday: boolean | null;
    tuesday: boolean | null;
    wednesday: boolean | null;
    thursday: boolean | null;
    friday: boolean | null;
    saturday: boolean | null;
    sunday: boolean | null;
    building: string | null;
    buildingDescription: string | null;
    room: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  type FacultyRow = {
    sectionCrn: string;
    displayName: string | null;
    sortOrder: number | null;
    primaryIndicator: boolean | null;
    id: number;
  };

  let meetingRaw: MeetingRow[] = [];
  let facultyRows: FacultyRow[] = [];
  if (meetingCrnList.length > 0) {
    [meetingRaw, facultyRows] = await Promise.all([
          db
            .select({
              id: schema.sectionMeetings.id,
              sectionCrn: schema.sectionMeetings.sectionCrn,
              beginTime: schema.sectionMeetings.beginTime,
              endTime: schema.sectionMeetings.endTime,
              meetingScheduleType: schema.sectionMeetings.meetingScheduleType,
              monday: schema.sectionMeetings.monday,
              tuesday: schema.sectionMeetings.tuesday,
              wednesday: schema.sectionMeetings.wednesday,
              thursday: schema.sectionMeetings.thursday,
              friday: schema.sectionMeetings.friday,
              saturday: schema.sectionMeetings.saturday,
              sunday: schema.sectionMeetings.sunday,
              building: schema.sectionMeetings.building,
              buildingDescription: schema.sectionMeetings.buildingDescription,
              room: schema.sectionMeetings.room,
              startDate: schema.sectionMeetings.startDate,
              endDate: schema.sectionMeetings.endDate,
            })
            .from(schema.sectionMeetings)
            .where(
              and(
                eq(schema.sectionMeetings.termCode, termCode),
                inArray(schema.sectionMeetings.sectionCrn, meetingCrnList),
              ),
            ),
          db
            .select({
              sectionCrn: schema.sectionFaculty.sectionCrn,
              displayName: schema.sectionFaculty.displayName,
              sortOrder: schema.sectionFaculty.sortOrder,
              primaryIndicator: schema.sectionFaculty.primaryIndicator,
              id: schema.sectionFaculty.id,
            })
            .from(schema.sectionFaculty)
            .where(
              and(
                eq(schema.sectionFaculty.termCode, termCode),
                inArray(schema.sectionFaculty.sectionCrn, meetingCrnList),
              ),
            )
            .orderBy(
              schema.sectionFaculty.sectionCrn,
              desc(schema.sectionFaculty.primaryIndicator),
              asc(schema.sectionFaculty.sortOrder),
              asc(schema.sectionFaculty.id),
            ),
        ]);
  }

  const meetings = meetingRaw.map((m) => ({
    ...m,
    beginTime: decodeHtmlEntities(m.beginTime),
    endTime: decodeHtmlEntities(m.endTime),
    meetingScheduleType: decodeHtmlEntities(m.meetingScheduleType),
    building: decodeHtmlEntities(m.building),
    buildingDescription: decodeHtmlEntities(m.buildingDescription),
    room: decodeHtmlEntities(m.room),
    startDate: decodeHtmlEntities(m.startDate),
    endDate: decodeHtmlEntities(m.endDate),
  }));

  const facultyByCrn: Record<string, string> = {};
  const namesByCrn = new Map<string, string[]>();
  for (const r of facultyRows) {
    const rawName = r.displayName?.trim();
    if (!rawName) continue;
    const name = decodeHtmlEntities(rawName) ?? rawName;
    const list = namesByCrn.get(r.sectionCrn) ?? [];
    list.push(name);
    namesByCrn.set(r.sectionCrn, list);
  }
  for (const [crn, names] of namesByCrn) {
    facultyByCrn[crn] = names.join(", ");
  }

  return {
    catalog: {
      sections: [...sectionByCrn.values()],
      meetings,
      linkedBundles,
      linkedBundleMembers,
      facultyByCrn,
      examReservationsByCrn: {},
      vagueExamNoteByCrn: {},
    },
  };
}

/**
 * Exam reservation badges from section information text (may fetch Banner
 * descriptions for uncached CRNs).
 */
export async function loadPlannerCatalogExamEnrichment(
  db: Database,
  termCode: string,
  plannerItems: PlannerItemRow[],
): Promise<PlannerCatalogExamEnrichment> {
  if (plannerItems.length === 0) {
    return { examReservationsByCrn: {}, vagueExamNoteByCrn: {} };
  }

  const crnList = await resolvePlannerCatalogAllCrns(db, termCode, plannerItems);
  try {
    await ensureSectionDescriptions(db, termCode, crnList, {
      onlyUncached: true,
    });
  } catch (err) {
    console.error(
      "loadPlannerCatalogExamEnrichment: section descriptions fetch failed",
      err,
    );
  }
  const sectionInfoByCrn = await loadSectionInformationByCrn(
    db,
    termCode,
    crnList,
  );

  const examReservationsByCrn: PlannerCatalogJson["examReservationsByCrn"] =
    {};
  const vagueExamNoteByCrn: PlannerCatalogJson["vagueExamNoteByCrn"] = {};
  for (const crn of crnList) {
    const text = sectionInfoByCrn.get(crn) ?? null;
    const { reservations, vagueExamNote } = parseExamReservations(text);
    if (reservations.length > 0) {
      examReservationsByCrn[crn] = reservations;
    }
    if (vagueExamNote && text) {
      vagueExamNoteByCrn[crn] = text;
    }
  }

  return { examReservationsByCrn, vagueExamNoteByCrn };
}
