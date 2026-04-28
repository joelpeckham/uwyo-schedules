import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { decodeHtmlEntities } from "@/lib/text/decodeHtmlEntities";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import type { PlannerCatalogJson } from "./client/catalog-types";
import type { PlannerItemRow } from "./data";
import { listPlannerItems } from "./data";
import {
  loadOrderedMembersForBundleIds,
  type PlannerItemSelection,
  resolveDisplayCrnsWithMemberMap,
} from "./resolve-display-crns";

export type PlannerTermUiStateRow = typeof schema.plannerTermUiState.$inferSelect;

async function loadPlannerTermUiState(
  db: Database,
  sessionId: string,
  termCode: string,
): Promise<PlannerTermUiStateRow | null> {
  const [row] = await db
    .select()
    .from(schema.plannerTermUiState)
    .where(
      and(
        eq(schema.plannerTermUiState.sessionId, sessionId),
        eq(schema.plannerTermUiState.termCode, termCode),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Loads planner items plus all catalog data needed to derive calendar blocks and
 * same-type swap ghosts client-side for the current term and session.
 */
export async function loadPlannerCatalogBootstrap(
  db: Database,
  sessionId: string,
  termCode: string,
): Promise<{
  plannerItems: PlannerItemRow[];
  catalog: PlannerCatalogJson;
  termUiState: PlannerTermUiStateRow | null;
}> {
  // The planner items query and the term UI state lookup are independent —
  // run them concurrently so we wait on the slower of the two instead of
  // their sum.
  const [plannerItems, termUiState] = await Promise.all([
    listPlannerItems(db, sessionId, termCode),
    loadPlannerTermUiState(db, sessionId, termCode),
  ]);
  if (plannerItems.length === 0) {
    return {
      plannerItems,
      catalog: {
        sections: [],
        meetings: [],
        linkedBundles: [],
        linkedBundleMembers: [],
        facultyByCrn: {},
      },
      termUiState,
    };
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

  const sectionByCrn = new Map<string, (typeof sectionRows)[number]>();
  for (const r of sectionRows) {
    sectionByCrn.set(r.crn, {
      ...r,
      scheduleTypeDescription: decodeHtmlEntities(r.scheduleTypeDescription),
      sequenceNumber: decodeHtmlEntities(r.sequenceNumber),
      subjectCourse: decodeHtmlEntities(r.subjectCourse),
    });
  }

  const courseSectionCrns = new Set(sectionRows.map((r) => r.crn));
  const allCrns = new Set<string>([...displayCrns, ...courseSectionCrns]);
  const crnListForBundles = [...allCrns];

  // `anchoredBundles` and `memberBundleHits` query different tables and are
  // independent. Fan them out in parallel so wall time is the slowest query
  // rather than their sum.
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
      })
      .from(schema.sections)
      .where(
        and(
          eq(schema.sections.termCode, termCode),
          inArray(schema.sections.crn, missingSectionCrns),
        ),
      );
    for (const r of extra) {
      sectionByCrn.set(r.crn, {
        ...r,
        scheduleTypeDescription: decodeHtmlEntities(r.scheduleTypeDescription),
        sequenceNumber: decodeHtmlEntities(r.sequenceNumber),
        subjectCourse: decodeHtmlEntities(r.subjectCourse),
      });
    }
  }

  const meetingCrnList = [...sectionByCrn.keys()];
  const meetingRaw =
    meetingCrnList.length === 0
      ? []
      : await db
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
          })
          .from(schema.sectionMeetings)
          .where(
            and(
              eq(schema.sectionMeetings.termCode, termCode),
              inArray(schema.sectionMeetings.sectionCrn, meetingCrnList),
            ),
          );
  const meetings = meetingRaw.map((m) => ({
    ...m,
    beginTime: decodeHtmlEntities(m.beginTime),
    endTime: decodeHtmlEntities(m.endTime),
    meetingScheduleType: decodeHtmlEntities(m.meetingScheduleType),
    building: decodeHtmlEntities(m.building),
    buildingDescription: decodeHtmlEntities(m.buildingDescription),
    room: decodeHtmlEntities(m.room),
  }));

  const facultyRows =
    meetingCrnList.length === 0
      ? []
      : await db
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
          );

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
    plannerItems,
    catalog: {
      sections: [...sectionByCrn.values()],
      meetings,
      linkedBundles,
      linkedBundleMembers,
      facultyByCrn,
    },
    termUiState,
  };
}
