"use server";

/**
 * Server-action cache policy:
 * - `ensurePlannerSessionAction` calls `revalidatePath("/")` once when a brand-new
 *   anonymous session cookie is minted so any statically cached homepage awareness updates.
 * - Planner persistence (`syncPlannerStateAction`, blackouts save, catalog bootstrap,
 *   prefetch, solve, search) deliberately does **not** revalidate routes on each call:
 *   the planner tab owns live state client-side; the next navigation or refresh loads
 *   `/planner` fresh from Postgres. Adding `revalidatePath` per debounced persist would
 *   thrash the Next cache without helping the happy path.
 * - When a `/planner` loader is wrapped in long-lived `"use cache"` keyed on session +
 *   term in the future, mutate actions that modify that cached payload should call the
 *   minimal `revalidatePath`/`updateTag` needed alongside their success paths.
 */

import { createDb } from "@/db/index";
import * as schema from "@/db/schema";
import { and, eq, notInArray } from "drizzle-orm";
import {
  defaultInstructorPrefs,
  parseInstructorPrefs,
  serializeInstructorPrefs,
  type InstructorPrefsV1,
} from "@/lib/planner/instructor-prefs";
import type { CourseSolvePack } from "@/lib/planner/solve-schedules-core";
import type { SolveSchedulesResult } from "@/lib/planner/solve-schedules";
import {
  loadCourseSolvePack,
  solveSchedulesForTerm,
} from "@/lib/planner/solve-schedules";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  pickUnusedCourseColor,
  isPlannerCoursePaletteColor,
} from "@/lib/planner/course-colors";
import {
  MAX_PLANNER_COURSES_PER_TERM,
  PLANNER_SESSION_COOKIE,
  UUID_RE,
} from "@/lib/planner/constants";
import {
  MAX_PLANNER_BLACKOUTS,
  parseBlackoutsItemsArray,
  parseBlackoutsJson,
  stableBlackoutsJsonForDb,
  type PlannerBlackoutsDocV1,
} from "@/lib/planner/blackouts";
import { loadPlannerCatalogBootstrap } from "@/lib/planner/catalog-bootstrap";
import { parseSectionPinsJson } from "@/lib/planner/section-pins";
import { normalizeScheduleTypeKey } from "@/lib/planner/swap-helpers";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import { catalogActionClientKey } from "@/lib/planner/catalog-action-client-key";
import { takeCatalogActionRateLimit } from "@/lib/planner/catalog-action-rate-limit";
import {
  getSectionDetail,
  listLinkedBundleOptionsForAnchors,
  listPlannerItems,
  listSectionsForCourseKeys,
  searchCourses,
  type CourseSearchRow,
  type PlannerItemRow,
} from "@/lib/planner/data";
const MAX_PRIMARY_PREFS = 12;
const MAX_SCHEDULE_TYPE_KEYS = 8;
const MAX_PREFS_PER_TYPE = 8;

function validateInstructorPrefsPayload(raw: unknown): {
  ok: true;
  value: InstructorPrefsV1;
} | { ok: false; error: string } {
  const parsed = parseInstructorPrefs(raw);
  const p = serializeInstructorPrefs(parsed);
  if (p.primary.length > MAX_PRIMARY_PREFS) {
    return { ok: false, error: "Too many primary instructor preferences." };
  }
  if (p.byScheduleType) {
    const keys = Object.keys(p.byScheduleType);
    if (keys.length > MAX_SCHEDULE_TYPE_KEYS) {
      return { ok: false, error: "Too many schedule-type preference groups." };
    }
    for (const arr of Object.values(p.byScheduleType) as string[][]) {
      if (arr.length > MAX_PREFS_PER_TYPE) {
        return {
          ok: false,
          error: "Too many instructor preferences for one schedule type.",
        };
      }
    }
  }
  return { ok: true, value: p };
}

function revalidateHome() {
  revalidatePath("/");
}

export async function ensurePlannerSessionAction(): Promise<{
  sessionId: string;
}> {
  const jar = await cookies();
  const existing = jar.get(PLANNER_SESSION_COOKIE)?.value;
  if (existing && UUID_RE.test(existing)) {
    return { sessionId: existing };
  }
  const db = createDb();
  const [row] = await db
    .insert(schema.plannerSessions)
    .values({})
    .returning({ id: schema.plannerSessions.id });
  if (!row) throw new Error("Could not create planner session");
  jar.set(PLANNER_SESSION_COOKIE, row.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  revalidateHome();
  return { sessionId: row.id };
}

async function requireSessionId(): Promise<string> {
  const jar = await cookies();
  const raw = jar.get(PLANNER_SESSION_COOKIE)?.value;
  if (!raw || !UUID_RE.test(raw)) {
    throw new Error("No planner session. Reload the page.");
  }
  return raw;
}

/** Add a course to the wish list (sections chosen automatically later). */
export async function addPlannerCourseWishAction(input: {
  termCode: string;
  subject: string;
  courseNumber: string;
}): Promise<
  { ok: true; item: PlannerItemRow } | { ok: false; error: string }
> {
  try {
    const sessionId = await requireSessionId();
    const db = createDb();

    const existingRows = await db
      .select({ displayColor: schema.plannerItems.displayColor })
      .from(schema.plannerItems)
      .where(
        and(
          eq(schema.plannerItems.sessionId, sessionId),
          eq(schema.plannerItems.termCode, input.termCode),
        ),
      );
    if (existingRows.length >= MAX_PLANNER_COURSES_PER_TERM) {
      return {
        ok: false,
        error: `At most ${MAX_PLANNER_COURSES_PER_TERM} courses for one term.`,
      };
    }
    const used = new Set(
      existingRows.map((r) => r.displayColor.trim().toLowerCase()),
    );
    const displayColor = pickUnusedCourseColor(used);

    const [inserted] = await db
      .insert(schema.plannerItems)
      .values({
        sessionId,
        termCode: input.termCode,
        subject: input.subject,
        courseNumber: input.courseNumber,
        displayColor,
        selectionKind: "unresolved",
        anchorCrn: null,
        linkedBundleId: null,
        instructorPrefs: defaultInstructorPrefs(),
      })
      .returning();
    if (!inserted) return { ok: false, error: "Could not add course." };
    return { ok: true, item: inserted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

export async function solveSchedulesAction(
  termCode: string,
  requireOpenSections: boolean,
): Promise<
  | { ok: true; result: SolveSchedulesResult }
  | { ok: false; error: string }
> {
  try {
    if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
      return { ok: false, error: "Too many requests. Try again in a moment." };
    }
    const sessionId = await requireSessionId();
    if (!termCode) return { ok: false, error: "Missing term." };
    const db = createDb();
    const items = await listPlannerItems(db, sessionId, termCode);
    const result = await solveSchedulesForTerm(db, termCode, items, {
      requireOpenSections,
      maxSolutions: 1,
    });
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

/** Public catalog data for client-side schedule solving (no session required). */
export async function prefetchCourseSolvePackAction(
  termCode: string,
  subject: string,
  courseNumber: string,
): Promise<
  { ok: true; pack: CourseSolvePack } | { ok: false; error: string }
> {
  try {
    if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
      return { ok: false, error: "Too many requests. Try again in a moment." };
    }
    if (!termCode.trim()) return { ok: false, error: "Missing term." };
    if (!subject.trim() || !courseNumber.trim()) {
      return { ok: false, error: "Missing course." };
    }
    const db = createDb();
    const pack = await loadCourseSolvePack(
      db,
      termCode,
      subject.trim(),
      courseNumber.trim(),
    );
    return { ok: true, pack };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

export async function savePlannerBlackoutsAction(input: {
  termCode: string;
  items: unknown;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionId = await requireSessionId();
    if (!input.termCode?.trim()) return { ok: false, error: "Missing term." };
    if (!Array.isArray(input.items)) {
      return { ok: false, error: "Invalid busy-time list." };
    }
    if (input.items.length > MAX_PLANNER_BLACKOUTS) {
      return {
        ok: false,
        error: `At most ${MAX_PLANNER_BLACKOUTS} busy-time blocks.`,
      };
    }
    const doc = parseBlackoutsItemsArray(input.items);
    const db = createDb();
    await db
      .insert(schema.plannerTermUiState)
      .values({
        sessionId,
        termCode: input.termCode.trim(),
        lastSolutionIndex: 0,
        favoriteSolutionIndex: null,
        blackouts: stableBlackoutsJsonForDb(doc),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          schema.plannerTermUiState.sessionId,
          schema.plannerTermUiState.termCode,
        ],
        set: {
          blackouts: stableBlackoutsJsonForDb(doc),
          updatedAt: new Date(),
        },
      });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

export async function updatePlannerItemColorAction(
  itemId: number,
  displayColor: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionId = await requireSessionId();
    if (!/^#[0-9A-Fa-f]{6}$/.test(displayColor)) {
      return { ok: false, error: "Use a #RRGGBB color." };
    }
    if (!isPlannerCoursePaletteColor(displayColor)) {
      return {
        ok: false,
        error: "Choose a color from the course color palette.",
      };
    }
    const db = createDb();
    const res = await db
      .update(schema.plannerItems)
      .set({ displayColor })
      .where(
        and(
          eq(schema.plannerItems.id, itemId),
          eq(schema.plannerItems.sessionId, sessionId),
        ),
      )
      .returning({ id: schema.plannerItems.id });
    if (res.length === 0) return { ok: false, error: "Item not found." };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

export async function searchCoursesAction(
  termCode: string,
  query: string,
): Promise<CourseSearchRow[]> {
  if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
    return [];
  }
  const db = createDb();
  return searchCourses(db, termCode, query);
}

/** Keys the client SectionDetailPanels actually renders. Anything else from
 * Banner is dropped before crossing the wire so we cannot accidentally leak
 * unrelated fields if Banner's API surface changes. */
const SECTION_DETAIL_TOP_KEYS = new Set([
  "subject",
  "courseNumber",
  "sequenceNumber",
  "subjectCourse",
  "courseReferenceNumber",
  "courseTitle",
  "scheduleTypeDescription",
  "campusDescription",
  "partOfTerm",
  "termDesc",
  "term",
  "creditHours",
  "creditHourLow",
  "creditHourHigh",
  "creditHourIndicator",
  "enrollment",
  "maximumEnrollment",
  "seatsAvailable",
  "waitCapacity",
  "waitCount",
  "waitAvailable",
  "isSectionLinked",
  "linkIdentifier",
  "openSection",
  "faculty",
  "meetingsFaculty",
  "sectionAttributes",
  "status",
]);

const FACULTY_KEYS = new Set(["displayName", "emailAddress", "primaryIndicator"]);
const MEETING_TIME_KEYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "beginTime",
  "endTime",
  "buildingDescription",
  "building",
  "room",
  "startDate",
  "endDate",
  "meetingTypeDescription",
  "meetingType",
  "meetingScheduleType",
]);
const ATTRIBUTE_KEYS = new Set(["code", "description", "isZTCAttribute"]);
const STATUS_KEYS = new Set([
  "sectionOpen",
  "select",
  "restricted",
  "timeConflict",
  "sectionStatus",
]);

function pickKeys(
  src: unknown,
  allowed: Set<string>,
): Record<string, unknown> | null {
  if (src === null || typeof src !== "object" || Array.isArray(src)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

function sanitizeSectionRawJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const top = pickKeys(obj, SECTION_DETAIL_TOP_KEYS);
  if (!top) return null;
  if (Array.isArray(top.faculty)) {
    top.faculty = (top.faculty as unknown[])
      .map((f) => pickKeys(f, FACULTY_KEYS))
      .filter((f): f is Record<string, unknown> => f !== null);
  }
  if (Array.isArray(top.meetingsFaculty)) {
    top.meetingsFaculty = (top.meetingsFaculty as unknown[])
      .map((m) => {
        if (m === null || typeof m !== "object" || Array.isArray(m)) return null;
        const mt = (m as Record<string, unknown>).meetingTime;
        return { meetingTime: pickKeys(mt, MEETING_TIME_KEYS) };
      })
      .filter((m): m is { meetingTime: Record<string, unknown> | null } => m !== null);
  }
  if (Array.isArray(top.sectionAttributes)) {
    top.sectionAttributes = (top.sectionAttributes as unknown[])
      .map((a) => pickKeys(a, ATTRIBUTE_KEYS))
      .filter((a): a is Record<string, unknown> => a !== null);
  }
  const sanitizedStatus = pickKeys(top.status, STATUS_KEYS);
  if (sanitizedStatus) top.status = sanitizedStatus;
  else delete top.status;
  return top;
}

export async function getSectionDetailAction(
  termCode: string,
  crn: string,
): Promise<{
  rawJson: Record<string, unknown> | null;
  title: string;
} | null> {
  if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
    return null;
  }
  const db = createDb();
  const r = await getSectionDetail(db, termCode, crn);
  if (!r) return null;
  const title =
    [
      r.subjectCourse ?? `${r.subject} ${r.courseNumber}`,
      r.sequenceNumber ? `#${r.sequenceNumber}` : "",
      r.scheduleTypeDescription,
    ]
      .filter(Boolean)
      .join(" · ") || `CRN ${crn}`;
  return { rawJson: sanitizeSectionRawJson(r.rawJson), title };
}

/** Full planner rows + catalog for client-side derivation (calendar, swap). */
export async function loadPlannerCatalogBootstrapAction(
  termCode: string,
): Promise<
  | {
      ok: true;
      plannerItems: PlannerItemRow[];
      catalog: PlannerCatalogJson;
      termUiState: {
        lastSolutionIndex: number;
        favoriteSolutionIndex: number | null;
        blackouts: PlannerBlackoutsDocV1;
      } | null;
    }
  | { ok: false; error: string }
> {
  try {
    if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
      return { ok: false, error: "Too many requests. Try again in a moment." };
    }
    const sessionId = await requireSessionId();
    if (!termCode) return { ok: false, error: "Missing term." };
    const db = createDb();
    const { plannerItems, catalog, termUiState } =
      await loadPlannerCatalogBootstrap(db, sessionId, termCode);
    return {
      ok: true,
      plannerItems,
      catalog,
      termUiState: termUiState
        ? {
            lastSolutionIndex: termUiState.lastSolutionIndex,
            favoriteSolutionIndex: termUiState.favoriteSolutionIndex,
            blackouts: parseBlackoutsJson(termUiState.blackouts),
          }
        : null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

/**
 * Batched validation for an entire planner cart in three round-trips
 * (sections, bundles+members, bundle-id existence) instead of two queries
 * per row. Up to 40 rows previously meant ~80 sequential queries running
 * before the transaction even opened.
 */
async function assertPlannerRowsPersistable(
  db: ReturnType<typeof createDb>,
  termCode: string,
  rows: PlannerItemRow[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const courseKeyPairs = new Map<string, { subject: string; courseNumber: string }>();
  const anchorCrns: string[] = [];

  for (const row of rows) {
    // Defensive runtime check at the DB boundary: server actions accept
    // arbitrary client payloads, so don't trust the type-level narrowing of
    // `PlannerItemRow.selectionKind` from `$type<SelectionKind>()` — verify
    // it really is one of the three valid values before persisting.
    if (
      row.selectionKind !== "unresolved" &&
      row.selectionKind !== "single_crn" &&
      row.selectionKind !== "linked_bundle"
    ) {
      return { ok: false, error: "Invalid selection kind in planner data." };
    }
    if (row.selectionKind === "unresolved") {
      if (row.anchorCrn != null || row.linkedBundleId != null) {
        return { ok: false, error: "Unresolved planner row must not have a section." };
      }
      const pins = parseSectionPinsJson(row.sectionPins);
      if (Object.keys(pins.byType).length === 0) continue;
      const key = `${row.subject}\u0000${row.courseNumber}`;
      if (!courseKeyPairs.has(key)) {
        courseKeyPairs.set(key, {
          subject: row.subject,
          courseNumber: row.courseNumber,
        });
      }
      continue;
    }
    const pinsOnResolved = parseSectionPinsJson(row.sectionPins);
    if (Object.keys(pinsOnResolved.byType).length > 0) {
      return {
        ok: false,
        error: "Section pins are only valid while the course uses automatic sections.",
      };
    }
    if (row.anchorCrn == null) {
      return { ok: false, error: "Resolved planner row is missing a section." };
    }
    anchorCrns.push(row.anchorCrn);
  }

  const [sectionsByCourse, bundlesByAnchor] = await Promise.all([
    courseKeyPairs.size > 0
      ? listSectionsForCourseKeys(db, termCode, [...courseKeyPairs.values()])
      : Promise.resolve(
          new Map<
            string,
            Awaited<ReturnType<typeof listSectionsForCourseKeys>> extends Map<
              string,
              infer V
            >
              ? V
              : never
          >(),
        ),
    anchorCrns.length > 0
      ? listLinkedBundleOptionsForAnchors(db, termCode, anchorCrns)
      : Promise.resolve(
          new Map<
            string,
            Awaited<ReturnType<typeof listLinkedBundleOptionsForAnchors>> extends Map<
              string,
              infer V
            >
              ? V
              : never
          >(),
        ),
  ]);

  for (const row of rows) {
    if (row.selectionKind === "unresolved") {
      const pins = parseSectionPinsJson(row.sectionPins);
      if (Object.keys(pins.byType).length === 0) continue;
      const key = `${row.subject}\u0000${row.courseNumber}`;
      const sections = sectionsByCourse.get(key) ?? [];
      const byCrn = new Map(sections.map((s) => [s.crn, s]));
      for (const [typeKey, pinnedCrn] of Object.entries(pins.byType)) {
        const sec = byCrn.get(pinnedCrn);
        if (!sec) {
          return {
            ok: false,
            error: "Pinned section is not part of this course.",
          };
        }
        if (normalizeScheduleTypeKey(sec.scheduleTypeDescription) !== typeKey) {
          return {
            ok: false,
            error: "Pinned section does not match schedule type.",
          };
        }
      }
      continue;
    }
    if (row.anchorCrn == null) continue;
    const bundles = bundlesByAnchor.get(row.anchorCrn) ?? [];
    if (bundles.length > 0) {
      if (row.selectionKind !== "linked_bundle" || row.linkedBundleId == null) {
        return {
          ok: false,
          error: "Linked registration required for one or more rows.",
        };
      }
      const matched = bundles.some((b) => b.id === row.linkedBundleId);
      if (!matched) {
        return { ok: false, error: "Invalid linked bundle in planner data." };
      }
    } else if (row.selectionKind !== "single_crn") {
      return { ok: false, error: "Invalid selection in planner data." };
    }
  }
  return { ok: true };
}

/**
 * Replaces the session's planner list for this term with the given rows
 * (delete missing ids, update the rest). Used by the client store debounced sync.
 */
export async function syncPlannerStateAction(
  termCode: string,
  items: PlannerItemRow[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionId = await requireSessionId();
    if (!termCode) return { ok: false, error: "Missing term." };
    if (items.length > MAX_PLANNER_COURSES_PER_TERM) {
      return {
        ok: false,
        error: `At most ${MAX_PLANNER_COURSES_PER_TERM} courses for one term.`,
      };
    }
    const db = createDb();

    for (const row of items) {
      if (row.termCode !== termCode) {
        return { ok: false, error: "Planner row term mismatch." };
      }
      const prefs = validateInstructorPrefsPayload(row.instructorPrefs);
      if (!prefs.ok) return { ok: false, error: prefs.error };
    }
    const v = await assertPlannerRowsPersistable(db, termCode, items);
    if (!v.ok) return v;

    await db.transaction(async (tx) => {
      if (items.length === 0) {
        await tx
          .delete(schema.plannerItems)
          .where(
            and(
              eq(schema.plannerItems.sessionId, sessionId),
              eq(schema.plannerItems.termCode, termCode),
            ),
          );
        return;
      }

      const keepIds = items.map((i) => i.id);
      await tx
        .delete(schema.plannerItems)
        .where(
          and(
            eq(schema.plannerItems.sessionId, sessionId),
            eq(schema.plannerItems.termCode, termCode),
            notInArray(schema.plannerItems.id, keepIds),
          ),
        );

      for (const row of items) {
        const res = await tx
          .update(schema.plannerItems)
          .set({
            subject: row.subject,
            courseNumber: row.courseNumber,
            displayColor: row.displayColor,
            selectionKind: row.selectionKind,
            anchorCrn:
              row.selectionKind === "unresolved" ? null : row.anchorCrn,
            linkedBundleId:
              row.selectionKind === "linked_bundle"
                ? row.linkedBundleId
                : null,
            instructorPrefs: (() => {
              const pr = validateInstructorPrefsPayload(row.instructorPrefs);
              if (!pr.ok) throw new Error(pr.error);
              return pr.value;
            })(),
            sectionPins: parseSectionPinsJson(row.sectionPins),
          })
          .where(
            and(
              eq(schema.plannerItems.id, row.id),
              eq(schema.plannerItems.sessionId, sessionId),
              eq(schema.plannerItems.termCode, termCode),
            ),
          )
          .returning({ id: schema.plannerItems.id });
        if (res.length === 0) {
          throw new Error(`Planner item ${row.id} is not in this session.`);
        }
      }
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}
