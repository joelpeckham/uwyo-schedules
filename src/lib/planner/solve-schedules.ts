import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { PlannerItemRow } from "./data";
import { listLinkedBundleOptions, listSectionsForCourse } from "./data";
import type { PlannerItemSelection } from "./resolve-display-crns-shared";
import { resolveDisplayCrnsSync } from "./resolve-display-crns-shared";
import { loadOrderedMembersForBundleIds } from "./resolve-display-crns";
import {
  courseSolvePackCourseKey,
  eligibleForStandaloneSingleCrn,
  meetingRowToIntervals,
  runSolveSearch,
  type CourseSolvePack,
  type ScheduleCandidate,
  type SolveSchedulesResult,
  type TimeInterval,
} from "./solve-schedules-core";

export * from "./solve-schedules-core";

/** CRNs that appear in a linked bundle as a member whose anchor is a different section (lab/discussion rows). */
async function loadLinkedNonAnchorMemberCrns(
  db: Database,
  termCode: string,
  sectionCrns: string[],
): Promise<Set<string>> {
  if (sectionCrns.length === 0) return new Set();
  const rows = await db
    .select({ crn: schema.linkedBundleMembers.crn })
    .from(schema.linkedBundleMembers)
    .innerJoin(
      schema.linkedBundles,
      eq(schema.linkedBundles.id, schema.linkedBundleMembers.bundleId),
    )
    .where(
      and(
        eq(schema.linkedBundles.termCode, termCode),
        inArray(schema.linkedBundleMembers.crn, sectionCrns),
        ne(schema.linkedBundles.anchorCrn, schema.linkedBundleMembers.crn),
      ),
    );
  return new Set(rows.map((r) => r.crn));
}

/** All registration options for one course as an unresolved wish-list row. */
export async function enumerateUnresolvedCandidatesForCourse(
  db: Database,
  termCode: string,
  subject: string,
  courseNumber: string,
): Promise<ScheduleCandidate[]> {
  const sections = await listSectionsForCourse(
    db,
    termCode,
    subject,
    courseNumber,
  );
  const sectionCrnList = sections.map((s) => s.crn);
  const linkedNonAnchorMemberCrns = await loadLinkedNonAnchorMemberCrns(
    db,
    termCode,
    sectionCrnList,
  );

  const out: ScheduleCandidate[] = [];
  for (const s of sections) {
    const bundles = await listLinkedBundleOptions(db, termCode, s.crn);
    if (bundles.length > 0) {
      for (const b of bundles) {
        const sel: PlannerItemSelection = {
          selectionKind: "linked_bundle",
          anchorCrn: s.crn,
          linkedBundleId: b.id,
        };
        const crns = resolveDisplayCrnsSync(sel, b.memberCrns);
        out.push({
          selectionKind: "linked_bundle",
          anchorCrn: s.crn,
          linkedBundleId: b.id,
          crns,
        });
      }
    } else if (eligibleForStandaloneSingleCrn(s.crn, linkedNonAnchorMemberCrns)) {
      out.push({
        selectionKind: "single_crn",
        anchorCrn: s.crn,
        linkedBundleId: null,
        crns: [s.crn],
      });
    }
  }
  return out;
}

async function enumerateCandidatesForItem(
  db: Database,
  termCode: string,
  item: PlannerItemRow,
  membersByBundleId: Map<number, string[]>,
): Promise<ScheduleCandidate[]> {
  if (item.selectionKind === "unresolved") {
    return enumerateUnresolvedCandidatesForCourse(
      db,
      termCode,
      item.subject,
      item.courseNumber,
    );
  }

  if (item.anchorCrn == null) return [];

  if (item.selectionKind === "single_crn") {
    return [
      {
        selectionKind: "single_crn",
        anchorCrn: item.anchorCrn,
        linkedBundleId: null,
        crns: [item.anchorCrn],
      },
    ];
  }

  if (item.selectionKind === "linked_bundle" && item.linkedBundleId != null) {
    const sel: PlannerItemSelection = {
      selectionKind: "linked_bundle",
      anchorCrn: item.anchorCrn,
      linkedBundleId: item.linkedBundleId,
    };
    const crns = resolveDisplayCrnsSync(
      sel,
      membersByBundleId.get(item.linkedBundleId) ?? [],
    );
    return [
      {
        selectionKind: "linked_bundle",
        anchorCrn: item.anchorCrn,
        linkedBundleId: item.linkedBundleId,
        crns,
      },
    ];
  }

  return [];
}

/** Server: one round-trip payload for client-side solve of a single course. */
export async function loadCourseSolvePack(
  db: Database,
  termCode: string,
  subject: string,
  courseNumber: string,
): Promise<CourseSolvePack> {
  const courseKey = courseSolvePackCourseKey(subject, courseNumber);
  const candidates = await enumerateUnresolvedCandidatesForCourse(
    db,
    termCode,
    subject,
    courseNumber,
  );

  const bundleIds = [
    ...new Set(
      candidates
        .map((c) => c.linkedBundleId)
        .filter((id): id is number => id != null),
    ),
  ];
  const membersByBundleId = await loadOrderedMembersForBundleIds(
    db,
    bundleIds,
  );
  const bundleMembersById: Record<string, string[]> = {};
  for (const [id, members] of membersByBundleId) {
    bundleMembersById[String(id)] = members;
  }

  const allCrns = new Set<string>();
  for (const c of candidates) {
    for (const crn of c.crns) allCrns.add(crn);
  }
  const crnList = [...allCrns];

  const meetingsByCrn: Record<string, TimeInterval[]> = {};
  if (crnList.length > 0) {
    const meetingRows = await db
      .select()
      .from(schema.sectionMeetings)
      .where(
        and(
          eq(schema.sectionMeetings.termCode, termCode),
          inArray(schema.sectionMeetings.sectionCrn, crnList),
        ),
      );
    for (const crn of crnList) meetingsByCrn[crn] = [];
    for (const m of meetingRows) {
      const list = meetingsByCrn[m.sectionCrn] ?? [];
      list.push(...meetingRowToIntervals(m));
      meetingsByCrn[m.sectionCrn] = list;
    }
  }

  const seatsByCrn: CourseSolvePack["seatsByCrn"] = {};
  if (crnList.length > 0) {
    const secRows = await db
      .select({
        crn: schema.sections.crn,
        seatsAvailable: schema.sections.seatsAvailable,
        openSection: schema.sections.openSection,
      })
      .from(schema.sections)
      .where(
        and(
          eq(schema.sections.termCode, termCode),
          inArray(schema.sections.crn, crnList),
        ),
      );
    for (const r of secRows) {
      seatsByCrn[r.crn] = {
        seatsAvailable: r.seatsAvailable,
        openSection: r.openSection,
      };
    }
  }

  const facultyByCrn: CourseSolvePack["facultyByCrn"] = {};
  const scheduleTypeByCrn: Record<string, string | null> = {};
  if (crnList.length > 0) {
    const facRows = await db
      .select({
        sectionCrn: schema.sectionFaculty.sectionCrn,
        displayName: schema.sectionFaculty.displayName,
        primaryIndicator: schema.sectionFaculty.primaryIndicator,
      })
      .from(schema.sectionFaculty)
      .where(
        and(
          eq(schema.sectionFaculty.termCode, termCode),
          inArray(schema.sectionFaculty.sectionCrn, crnList),
        ),
      );
    for (const r of facRows) {
      const list = facultyByCrn[r.sectionCrn] ?? [];
      list.push({
        displayName: r.displayName,
        primaryIndicator: r.primaryIndicator,
      });
      facultyByCrn[r.sectionCrn] = list;
    }

    const stRows = await db
      .select({
        crn: schema.sections.crn,
        scheduleTypeDescription: schema.sections.scheduleTypeDescription,
      })
      .from(schema.sections)
      .where(
        and(
          eq(schema.sections.termCode, termCode),
          inArray(schema.sections.crn, crnList),
        ),
      );
    for (const r of stRows) {
      scheduleTypeByCrn[r.crn] = r.scheduleTypeDescription;
    }
  }

  return {
    v: 1,
    courseKey,
    termCode,
    subject,
    courseNumber,
    candidates,
    bundleMembersById,
    meetingsByCrn,
    facultyByCrn,
    scheduleTypeByCrn,
    seatsByCrn,
  };
}

/**
 * Enumerates non-overlapping schedules (one candidate per planner row).
 * Resolved rows contribute a single fixed candidate; unresolved rows search all sections/bundles.
 */
export async function solveSchedulesForTerm(
  db: Database,
  termCode: string,
  items: PlannerItemRow[],
  opts: {
    requireOpenSections: boolean;
    maxSolutions?: number;
    timeoutMs?: number;
  },
): Promise<SolveSchedulesResult> {
  const maxSolutions = opts.maxSolutions ?? 500;
  const timeoutMs = opts.timeoutMs ?? 2000;

  if (items.length === 0) {
    return { solutions: [], capped: false, timedOut: false, itemOrder: [] };
  }

  const bundleIds = [
    ...new Set(
      items
        .map((i) => i.linkedBundleId)
        .filter((id): id is number => id != null),
    ),
  ];
  const membersByBundleId = await loadOrderedMembersForBundleIds(db, bundleIds);

  const candidateLists: ScheduleCandidate[][] = [];
  for (const item of items) {
    candidateLists.push(
      await enumerateCandidatesForItem(db, termCode, item, membersByBundleId),
    );
  }

  const allCrns = new Set<string>();
  for (const list of candidateLists) {
    for (const c of list) {
      for (const crn of c.crns) allCrns.add(crn);
    }
  }
  const crnList = [...allCrns];

  const meetingsByCrn = new Map<string, TimeInterval[]>();
  if (crnList.length > 0) {
    const meetingRows = await db
      .select()
      .from(schema.sectionMeetings)
      .where(
        and(
          eq(schema.sectionMeetings.termCode, termCode),
          inArray(schema.sectionMeetings.sectionCrn, crnList),
        ),
      );
    for (const crn of crnList) meetingsByCrn.set(crn, []);
    for (const m of meetingRows) {
      const list = meetingsByCrn.get(m.sectionCrn) ?? [];
      list.push(...meetingRowToIntervals(m));
      meetingsByCrn.set(m.sectionCrn, list);
    }
  }

  const seatsByCrn = new Map<
    string,
    { seatsAvailable: number | null; openSection: boolean | null }
  >();
  if (opts.requireOpenSections && crnList.length > 0) {
    const secRows = await db
      .select({
        crn: schema.sections.crn,
        seatsAvailable: schema.sections.seatsAvailable,
        openSection: schema.sections.openSection,
      })
      .from(schema.sections)
      .where(
        and(
          eq(schema.sections.termCode, termCode),
          inArray(schema.sections.crn, crnList),
        ),
      );
    for (const r of secRows) {
      seatsByCrn.set(r.crn, {
        seatsAvailable: r.seatsAvailable,
        openSection: r.openSection,
      });
    }
  }

  const facultyByCrn = new Map<
    string,
    { displayName: string | null; primaryIndicator: boolean | null }[]
  >();
  const scheduleTypeByCrn = new Map<string, string | null>();
  if (crnList.length > 0) {
    const facRows = await db
      .select({
        sectionCrn: schema.sectionFaculty.sectionCrn,
        displayName: schema.sectionFaculty.displayName,
        primaryIndicator: schema.sectionFaculty.primaryIndicator,
      })
      .from(schema.sectionFaculty)
      .where(
        and(
          eq(schema.sectionFaculty.termCode, termCode),
          inArray(schema.sectionFaculty.sectionCrn, crnList),
        ),
      );
    for (const r of facRows) {
      const list = facultyByCrn.get(r.sectionCrn) ?? [];
      list.push({
        displayName: r.displayName,
        primaryIndicator: r.primaryIndicator,
      });
      facultyByCrn.set(r.sectionCrn, list);
    }

    const stRows = await db
      .select({
        crn: schema.sections.crn,
        scheduleTypeDescription: schema.sections.scheduleTypeDescription,
      })
      .from(schema.sections)
      .where(
        and(
          eq(schema.sections.termCode, termCode),
          inArray(schema.sections.crn, crnList),
        ),
      );
    for (const r of stRows) {
      scheduleTypeByCrn.set(r.crn, r.scheduleTypeDescription);
    }
  }

  return runSolveSearch({
    items,
    candidateLists,
    meetingsByCrn,
    facultyByCrn,
    scheduleTypeByCrn,
    seatsByCrn,
    requireOpenSections: opts.requireOpenSections,
    maxSolutions,
    timeoutMs,
  });
}
