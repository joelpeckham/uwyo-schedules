"use server";

import { createDb } from "@/db/index";
import * as schema from "@/db/schema";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  DEFAULT_DISPLAY_COLOR,
  PLANNER_SESSION_COOKIE,
  UUID_RE,
} from "@/lib/planner/constants";
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
import type { SelectionKind } from "@/lib/planner/resolve-display-crns";

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

export async function addPlannerItemAction(input: {
  termCode: string;
  subject: string;
  courseNumber: string;
  anchorCrn: string;
  selectionKind: SelectionKind;
  linkedBundleId: number | null;
  displayColor?: string;
}): Promise<
  { ok: true; item: PlannerItemRow } | { ok: false; error: string }
> {
  try {
    const sessionId = await requireSessionId();
    const db = createDb();
    const bundles = await listLinkedBundleOptions(
      db,
      input.termCode,
      input.anchorCrn,
    );
    if (bundles.length > 0) {
      if (input.selectionKind !== "linked_bundle" || input.linkedBundleId == null) {
        return {
          ok: false,
          error: "Pick a linked registration option for this section.",
        };
      }
      const ok = await validateLinkedBundle(
        db,
        input.termCode,
        input.anchorCrn,
        input.linkedBundleId,
      );
      if (!ok) return { ok: false, error: "Invalid linked option." };
    } else {
      if (input.selectionKind !== "single_crn") {
        return { ok: false, error: "Invalid selection for this section." };
      }
    }

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
        displayColor: input.displayColor ?? DEFAULT_DISPLAY_COLOR,
        sortOrder: nextOrder,
        selectionKind: input.selectionKind,
        anchorCrn: input.anchorCrn,
        linkedBundleId:
          input.selectionKind === "linked_bundle" ? input.linkedBundleId : null,
      })
      .returning();
    if (!inserted) return { ok: false, error: "Could not add course." };
    return { ok: true, item: inserted };
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

export async function updatePlannerItemSelectionAction(input: {
  itemId: number;
  termCode: string;
  anchorCrn: string;
  selectionKind: SelectionKind;
  linkedBundleId: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionId = await requireSessionId();
    const db = createDb();
    const bundles = await listLinkedBundleOptions(
      db,
      input.termCode,
      input.anchorCrn,
    );
    if (bundles.length > 0) {
      if (input.selectionKind !== "linked_bundle" || input.linkedBundleId == null) {
        return {
          ok: false,
          error: "Pick a linked registration option for this section.",
        };
      }
      const ok = await validateLinkedBundle(
        db,
        input.termCode,
        input.anchorCrn,
        input.linkedBundleId,
      );
      if (!ok) return { ok: false, error: "Invalid linked option." };
    } else if (input.selectionKind !== "single_crn") {
      return { ok: false, error: "Invalid selection." };
    }

    const res = await db
      .update(schema.plannerItems)
      .set({
        anchorCrn: input.anchorCrn,
        selectionKind: input.selectionKind,
        linkedBundleId:
          input.selectionKind === "linked_bundle"
            ? input.linkedBundleId
            : null,
      })
      .where(
        and(
          eq(schema.plannerItems.id, input.itemId),
          eq(schema.plannerItems.sessionId, sessionId),
          eq(schema.plannerItems.termCode, input.termCode),
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
  | { ok: true; plannerItems: PlannerItemRow[]; catalog: PlannerCatalogJson }
  | { ok: false; error: string }
> {
  try {
    const sessionId = await requireSessionId();
    if (!termCode) return { ok: false, error: "Missing term." };
    const db = createDb();
    const { plannerItems, catalog } = await loadPlannerCatalogBootstrap(
      db,
      sessionId,
      termCode,
    );
    return { ok: true, plannerItems, catalog };
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
            anchorCrn: row.anchorCrn,
            linkedBundleId:
              row.selectionKind === "linked_bundle"
                ? row.linkedBundleId
                : null,
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
