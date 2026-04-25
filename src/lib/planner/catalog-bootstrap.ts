import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import type { PlannerCatalogJson } from "./client/catalog-types";
import type { PlannerItemRow } from "./data";
import { listPlannerItems } from "./data";
import {
  loadOrderedMembersForBundleIds,
  type PlannerItemSelection,
  resolveDisplayCrnsWithMemberMap,
} from "./resolve-display-crns";

/**
 * Loads planner items plus all catalog data needed to derive calendar blocks and
 * same-type swap ghosts client-side for the current term and session.
 */
export async function loadPlannerCatalogBootstrap(
  db: Database,
  sessionId: string,
  termCode: string,
): Promise<{ plannerItems: PlannerItemRow[]; catalog: PlannerCatalogJson }> {
  const plannerItems = await listPlannerItems(db, sessionId, termCode);
  if (plannerItems.length === 0) {
    return {
      plannerItems,
      catalog: {
        sections: [],
        meetings: [],
        linkedBundles: [],
        linkedBundleMembers: [],
      },
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
      selectionKind: item.selectionKind as PlannerItemSelection["selectionKind"],
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
  for (const r of sectionRows) sectionByCrn.set(r.crn, r);

  const courseSectionCrns = new Set(sectionRows.map((r) => r.crn));
  const allCrns = new Set<string>([...displayCrns, ...courseSectionCrns]);
  const crnListForBundles = [...allCrns];

  const anchoredBundles =
    crnListForBundles.length === 0
      ? []
      : await db
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
          );

  const memberBundleHits =
    crnListForBundles.length === 0
      ? []
      : await db
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
          );

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
    for (const r of extra) sectionByCrn.set(r.crn, r);
  }

  const meetingCrnList = [...sectionByCrn.keys()];
  const meetings =
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

  return {
    plannerItems,
    catalog: {
      sections: [...sectionByCrn.values()],
      meetings,
      linkedBundles,
      linkedBundleMembers,
    },
  };
}
