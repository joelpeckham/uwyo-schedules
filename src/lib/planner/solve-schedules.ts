import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { blackoutsDocToTimeIntervals, parseBlackoutsJson } from "./blackouts";
import { buildDeliveryModeByCrn } from "@/lib/sections/delivery-mode";
import type { PlannerScheduleFilters } from "./schedule-filters";
import {
  listLinkedBundleOptionsForAnchors,
  listSectionsForCourse,
  type PlannerItemRow,
} from "./data";
import type { PlannerItemSelection } from "./resolve-display-crns-shared";
import { resolveDisplayCrnsSync } from "./resolve-display-crns-shared";
import { loadOrderedMembersForBundleIds } from "./resolve-display-crns";
import {
  filterCandidatesBySectionPins,
  parseSectionPinsJson,
} from "./section-pins";
import {
  courseSolvePackCourseKey,
  DEFAULT_MAX_SOLUTIONS,
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

const ENUMERATE_CANDIDATES_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  inputs: readonly T[],
  limit: number,
  worker: (input: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(inputs.length);
  let next = 0;
  async function runWorker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= inputs.length) return;
      results[i] = await worker(inputs[i]!, i);
    }
  }
  const n = Math.min(limit, Math.max(1, inputs.length));
  await Promise.all(Array.from({ length: n }, () => runWorker()));
  return results;
}

/** All registration options for one course as an unresolved wish-list row. */
async function enumerateUnresolvedCandidatesForCourse(
  db: Database,
  termCode: string,
  subject: string,
  courseNumber: string,
): Promise<{
  candidates: ScheduleCandidate[];
  scheduleTypeByCrn: Map<string, string | null>;
}> {
  const sections = await listSectionsForCourse(
    db,
    termCode,
    subject,
    courseNumber,
  );
  const scheduleTypeByCrn = new Map<string, string | null>();
  for (const s of sections) {
    scheduleTypeByCrn.set(s.crn, s.scheduleTypeDescription);
  }

  const sectionCrnList = sections.map((s) => s.crn);
  const linkedNonAnchorMemberCrns = await loadLinkedNonAnchorMemberCrns(
    db,
    termCode,
    sectionCrnList,
  );

  const bundlesByAnchor =
    sectionCrnList.length === 0
      ? new Map()
      : await listLinkedBundleOptionsForAnchors(db, termCode, sectionCrnList);

  const out: ScheduleCandidate[] = [];
  for (const s of sections) {
    const bundles = bundlesByAnchor.get(s.crn) ?? [];
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
  return { candidates: out, scheduleTypeByCrn };
}

async function enumerateCandidatesForItem(
  db: Database,
  termCode: string,
  item: PlannerItemRow,
  membersByBundleId: Map<number, string[]>,
): Promise<ScheduleCandidate[]> {
  if (item.selectionKind === "unresolved") {
    const { candidates: list, scheduleTypeByCrn } =
      await enumerateUnresolvedCandidatesForCourse(
        db,
        termCode,
        item.subject,
        item.courseNumber,
      );
    const pins = parseSectionPinsJson(item.sectionPins);
    if (Object.keys(pins.byType).length === 0) return list;
    return filterCandidatesBySectionPins(list, pins, scheduleTypeByCrn);
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
  const { candidates } = await enumerateUnresolvedCandidatesForCourse(
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

  // Fan out the three independent CRN reads (meetings, faculty, sections)
  // so the round-trip cost is the slowest query rather than their sum, and
  // collapse the previous two `sections` queries (seats + schedule type)
  // into a single select.
  const [meetingRows, facRows, secRows] = await Promise.all([
    crnList.length === 0
      ? Promise.resolve([] as (typeof schema.sectionMeetings.$inferSelect)[])
      : db
          .select()
          .from(schema.sectionMeetings)
          .where(
            and(
              eq(schema.sectionMeetings.termCode, termCode),
              inArray(schema.sectionMeetings.sectionCrn, crnList),
            ),
          ),
    crnList.length === 0
      ? Promise.resolve(
          [] as {
            sectionCrn: string;
            displayName: string | null;
            primaryIndicator: boolean | null;
          }[],
        )
      : db
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
          ),
    crnList.length === 0
      ? Promise.resolve(
          [] as {
            crn: string;
            seatsAvailable: number | null;
            openSection: boolean | null;
            scheduleTypeDescription: string | null;
            instructionalMethod: string | null;
            instructionalMethodDescription: string | null;
          }[],
        )
      : db
          .select({
            crn: schema.sections.crn,
            seatsAvailable: schema.sections.seatsAvailable,
            openSection: schema.sections.openSection,
            scheduleTypeDescription: schema.sections.scheduleTypeDescription,
            instructionalMethod: schema.sections.instructionalMethod,
            instructionalMethodDescription:
              schema.sections.instructionalMethodDescription,
          })
          .from(schema.sections)
          .where(
            and(
              eq(schema.sections.termCode, termCode),
              inArray(schema.sections.crn, crnList),
            ),
          ),
  ]);

  const meetingsByCrn: Record<string, TimeInterval[]> = {};
  for (const crn of crnList) meetingsByCrn[crn] = [];
  for (const m of meetingRows) {
    const list = meetingsByCrn[m.sectionCrn] ?? [];
    list.push(...meetingRowToIntervals(m));
    meetingsByCrn[m.sectionCrn] = list;
  }

  const seatsByCrn: CourseSolvePack["seatsByCrn"] = {};
  const scheduleTypeByCrn: Record<string, string | null> = {};
  for (const r of secRows) {
    seatsByCrn[r.crn] = {
      seatsAvailable: r.seatsAvailable,
      openSection: r.openSection,
    };
    scheduleTypeByCrn[r.crn] = r.scheduleTypeDescription;
  }

  const facultyByCrn: CourseSolvePack["facultyByCrn"] = {};
  for (const r of facRows) {
    const list = facultyByCrn[r.sectionCrn] ?? [];
    list.push({
      displayName: r.displayName,
      primaryIndicator: r.primaryIndicator,
    });
    facultyByCrn[r.sectionCrn] = list;
  }

  const deliveryModeByCrn = buildDeliveryModeByCrn(secRows, meetingRows);

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
    deliveryModeByCrn,
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
  opts: PlannerScheduleFilters & {
    maxSolutions?: number;
    timeoutMs?: number;
  },
): Promise<SolveSchedulesResult> {
  const maxSolutions = opts.maxSolutions ?? DEFAULT_MAX_SOLUTIONS;
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

  const candidateLists = await mapWithConcurrency(
    items,
    ENUMERATE_CANDIDATES_CONCURRENCY,
    (item) => enumerateCandidatesForItem(db, termCode, item, membersByBundleId),
  );

  const allCrns = new Set<string>();
  for (const list of candidateLists) {
    for (const c of list) {
      for (const crn of c.crns) allCrns.add(crn);
    }
  }
  const crnList = [...allCrns];

  const sessionId = items[0]!.sessionId;
  for (const r of items) {
    if (r.sessionId !== sessionId) {
      throw new Error(
        "solveSchedulesForTerm: planner items must share a single session.",
      );
    }
    if (r.termCode !== termCode) {
      throw new Error(
        "solveSchedulesForTerm: planner items must match the requested term.",
      );
    }
  }

  // All four reads (meetings, faculty, sections, planner ui) are independent.
  // Fan them out in a single `Promise.all` so total wall time is the slowest
  // round-trip rather than their sum, and merge the previous two `sections`
  // selects (seats + schedule type) into a single query.
  const [meetingRows, facRows, secRows, uiRow] = await Promise.all([
    crnList.length === 0
      ? Promise.resolve([] as (typeof schema.sectionMeetings.$inferSelect)[])
      : db
          .select()
          .from(schema.sectionMeetings)
          .where(
            and(
              eq(schema.sectionMeetings.termCode, termCode),
              inArray(schema.sectionMeetings.sectionCrn, crnList),
            ),
          ),
    crnList.length === 0
      ? Promise.resolve(
          [] as {
            sectionCrn: string;
            displayName: string | null;
            primaryIndicator: boolean | null;
          }[],
        )
      : db
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
          ),
    crnList.length === 0
      ? Promise.resolve(
          [] as {
            crn: string;
            seatsAvailable: number | null;
            openSection: boolean | null;
            scheduleTypeDescription: string | null;
            instructionalMethod: string | null;
            instructionalMethodDescription: string | null;
          }[],
        )
      : db
          .select({
            crn: schema.sections.crn,
            seatsAvailable: schema.sections.seatsAvailable,
            openSection: schema.sections.openSection,
            scheduleTypeDescription: schema.sections.scheduleTypeDescription,
            instructionalMethod: schema.sections.instructionalMethod,
            instructionalMethodDescription:
              schema.sections.instructionalMethodDescription,
          })
          .from(schema.sections)
          .where(
            and(
              eq(schema.sections.termCode, termCode),
              inArray(schema.sections.crn, crnList),
            ),
          ),
    db
      .select({
        blackouts: schema.plannerTermUiState.blackouts,
      })
      .from(schema.plannerTermUiState)
      .where(
        and(
          eq(schema.plannerTermUiState.sessionId, sessionId),
          eq(schema.plannerTermUiState.termCode, termCode),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  const meetingsByCrn = new Map<string, TimeInterval[]>();
  for (const crn of crnList) meetingsByCrn.set(crn, []);
  for (const m of meetingRows) {
    const list = meetingsByCrn.get(m.sectionCrn) ?? [];
    list.push(...meetingRowToIntervals(m));
    meetingsByCrn.set(m.sectionCrn, list);
  }

  const seatsByCrn = new Map<
    string,
    { seatsAvailable: number | null; openSection: boolean | null }
  >();
  const scheduleTypeByCrn = new Map<string, string | null>();
  for (const r of secRows) {
    if (opts.requireOpenSections) {
      seatsByCrn.set(r.crn, {
        seatsAvailable: r.seatsAvailable,
        openSection: r.openSection,
      });
    }
    scheduleTypeByCrn.set(r.crn, r.scheduleTypeDescription);
  }

  const facultyByCrn = new Map<
    string,
    { displayName: string | null; primaryIndicator: boolean | null }[]
  >();
  for (const r of facRows) {
    const list = facultyByCrn.get(r.sectionCrn) ?? [];
    list.push({
      displayName: r.displayName,
      primaryIndicator: r.primaryIndicator,
    });
    facultyByCrn.set(r.sectionCrn, list);
  }

  const blackoutIntervals = uiRow
    ? blackoutsDocToTimeIntervals(parseBlackoutsJson(uiRow.blackouts))
    : [];

  const deliveryModeByCrn = new Map(
    Object.entries(buildDeliveryModeByCrn(secRows, meetingRows)),
  );

  return runSolveSearch({
    items,
    candidateLists,
    meetingsByCrn,
    facultyByCrn,
    scheduleTypeByCrn,
    seatsByCrn,
    deliveryModeByCrn,
    requireOpenSections: opts.requireOpenSections,
    excludeTba: opts.excludeTba,
    excludeOnlineAsync: opts.excludeOnlineAsync,
    blackoutIntervals,
    maxSolutions,
    timeoutMs,
  });
}
