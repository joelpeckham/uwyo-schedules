"use server";

import { createDb } from "@/db/index";
import * as schema from "@/db/schema";
import { and, eq, notInArray, sql } from "drizzle-orm";
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
import { PLANNER_SESSION_COOKIE, UUID_RE } from "@/lib/planner/constants";
import { loadPlannerCatalogBootstrap } from "@/lib/planner/catalog-bootstrap";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import {
  getSectionDetail,
  listLinkedBundleOptions,
  listPlannerItems,
  listSectionsForCourse,
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

async function validateLinkedBundle(
  db: ReturnType<typeof createDb>,
  termCode: string,
  anchorCrn: string,
  bundleId: number,
): Promise<boolean> {
  const [b] = await db
    .select({ id: schema.linkedBundles.id })
    .from(schema.linkedBundles)
    .where(
      and(
        eq(schema.linkedBundles.id, bundleId),
        eq(schema.linkedBundles.termCode, termCode),
        eq(schema.linkedBundles.anchorCrn, anchorCrn),
      ),
    )
    .limit(1);
  return !!b;
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

    const colorRows = await db
      .select({ displayColor: schema.plannerItems.displayColor })
      .from(schema.plannerItems)
      .where(
        and(
          eq(schema.plannerItems.sessionId, sessionId),
          eq(schema.plannerItems.termCode, input.termCode),
        ),
      );
    const used = new Set(
      colorRows.map((r) => r.displayColor.trim().toLowerCase()),
    );
    const displayColor = pickUnusedCourseColor(used);

    const [maxRow] = await db
      .select({ m: sql<number>`max(${schema.plannerItems.sortOrder})` })
      .from(schema.plannerItems)
      .where(
        and(
          eq(schema.plannerItems.sessionId, sessionId),
          eq(schema.plannerItems.termCode, input.termCode),
        ),
      );
    const nextOrder = (maxRow?.m ?? -1) + 1;

    const [inserted] = await db
      .insert(schema.plannerItems)
      .values({
        sessionId,
        termCode: input.termCode,
        subject: input.subject,
        courseNumber: input.courseNumber,
        displayColor,
        sortOrder: nextOrder,
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
    const sessionId = await requireSessionId();
    if (!termCode) return { ok: false, error: "Missing term." };
    const db = createDb();
    const items = await listPlannerItems(db, sessionId, termCode);
    const result = await solveSchedulesForTerm(db, termCode, items, {
      requireOpenSections,
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

export async function updatePlannerTermUiStateAction(input: {
  termCode: string;
  lastSolutionIndex: number;
  favoriteSolutionIndex: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionId = await requireSessionId();
    if (!input.termCode) return { ok: false, error: "Missing term." };
    if (input.lastSolutionIndex < 0) {
      return { ok: false, error: "Invalid solution index." };
    }
    const db = createDb();
    await db
      .insert(schema.plannerTermUiState)
      .values({
        sessionId,
        termCode: input.termCode,
        lastSolutionIndex: input.lastSolutionIndex,
        favoriteSolutionIndex: input.favoriteSolutionIndex,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          schema.plannerTermUiState.sessionId,
          schema.plannerTermUiState.termCode,
        ],
        set: {
          lastSolutionIndex: input.lastSolutionIndex,
          favoriteSolutionIndex: input.favoriteSolutionIndex,
          updatedAt: new Date(),
        },
      });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

export async function removePlannerItemAction(
  itemId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionId = await requireSessionId();
    const db = createDb();
    const res = await db
      .delete(schema.plannerItems)
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

export async function reorderPlannerItemAction(
  itemId: number,
  direction: "up" | "down",
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionId = await requireSessionId();
    const db = createDb();
    const [item] = await db
      .select()
      .from(schema.plannerItems)
      .where(
        and(
          eq(schema.plannerItems.id, itemId),
          eq(schema.plannerItems.sessionId, sessionId),
        ),
      )
      .limit(1);
    if (!item) return { ok: false, error: "Item not found." };

    const ordered = await listPlannerItems(db, sessionId, item.termCode);
    const idx = ordered.findIndex((r) => r.id === itemId);
    if (idx < 0) return { ok: false, error: "Item not found." };
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return { ok: true };

    const a = ordered[idx]!;
    const b = ordered[swapIdx]!;
    await db.transaction(async (tx) => {
      await tx
        .update(schema.plannerItems)
        .set({ sortOrder: b.sortOrder })
        .where(eq(schema.plannerItems.id, a.id));
      await tx
        .update(schema.plannerItems)
        .set({ sortOrder: a.sortOrder })
        .where(eq(schema.plannerItems.id, b.id));
    });
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
  const db = createDb();
  return searchCourses(db, termCode, query);
}

export async function listSectionsForCourseAction(
  termCode: string,
  subject: string,
  courseNumber: string,
) {
  const db = createDb();
  return listSectionsForCourse(db, termCode, subject, courseNumber);
}

export async function listLinkedBundleOptionsAction(
  termCode: string,
  anchorCrn: string,
) {
  const db = createDb();
  return listLinkedBundleOptions(db, termCode, anchorCrn);
}

export async function getSectionDetailAction(
  termCode: string,
  crn: string,
): Promise<{
  rawJson: unknown;
  title: string;
} | null> {
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
  return { rawJson: r.rawJson, title };
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
      } | null;
    }
  | { ok: false; error: string }
> {
  try {
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
          }
        : null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

async function assertPlannerRowPersistable(
  db: ReturnType<typeof createDb>,
  termCode: string,
  row: PlannerItemRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (row.selectionKind === "unresolved") {
    if (row.anchorCrn != null || row.linkedBundleId != null) {
      return { ok: false, error: "Unresolved planner row must not have a section." };
    }
    return { ok: true };
  }
  if (row.anchorCrn == null) {
    return { ok: false, error: "Resolved planner row is missing a section." };
  }
  const bundles = await listLinkedBundleOptions(db, termCode, row.anchorCrn);
  if (bundles.length > 0) {
    if (row.selectionKind !== "linked_bundle" || row.linkedBundleId == null) {
      return {
        ok: false,
        error: "Linked registration required for one or more rows.",
      };
    }
    const ok = await validateLinkedBundle(
      db,
      termCode,
      row.anchorCrn,
      row.linkedBundleId,
    );
    if (!ok) return { ok: false, error: "Invalid linked bundle in planner data." };
  } else if (row.selectionKind !== "single_crn") {
    return { ok: false, error: "Invalid selection in planner data." };
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
    const db = createDb();

    for (const row of items) {
      const prefs = validateInstructorPrefsPayload(row.instructorPrefs);
      if (!prefs.ok) return { ok: false, error: prefs.error };
      const v = await assertPlannerRowPersistable(db, termCode, row);
      if (!v.ok) return v;
    }

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
            sortOrder: row.sortOrder,
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
