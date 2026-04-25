"use server";

import { createDb } from "@/db/index";
import * as schema from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  DEFAULT_DISPLAY_COLOR,
  PLANNER_SESSION_COOKIE,
  UUID_RE,
} from "@/lib/planner/constants";
import {
  buildCalendarBlocks,
  buildSwapGhostsPrefetchMap,
  getSectionDetail,
  getSectionMeetingContextForSwap,
  listLinkedBundleOptions,
  listPlannerItems,
  listSameTypeSwapGhostMeetings,
  listSectionsForCourse,
  resolvePlannerSwapCommit,
  searchCourses,
  type CalendarBlock,
  type CourseSearchRow,
  type PlannerItemRow,
  type SwapGhostMeeting,
} from "@/lib/planner/data";
import type { SelectionKind } from "@/lib/planner/resolve-display-crns";
import { normalizeScheduleTypeKey } from "@/lib/planner/swap-helpers";

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

    await db.insert(schema.plannerItems).values({
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
    });
    revalidateHome();
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
    revalidateHome();
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
    revalidateHome();
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
    revalidateHome();
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
    revalidateHome();
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

export async function getSameTypeSectionMeetingsForSwapAction(input: {
  termCode: string;
  plannerItemId: number;
  sourceSectionCrn: string;
  sourceMeetingId: number;
}): Promise<
  { ok: true; ghosts: SwapGhostMeeting[] } | { ok: false; error: string }
> {
  try {
    const sessionId = await requireSessionId();
    const db = createDb();
    const [item] = await db
      .select()
      .from(schema.plannerItems)
      .where(
        and(
          eq(schema.plannerItems.id, input.plannerItemId),
          eq(schema.plannerItems.sessionId, sessionId),
          eq(schema.plannerItems.termCode, input.termCode),
        ),
      )
      .limit(1);
    if (!item) return { ok: false, error: "Item not found." };

    const ctx = await getSectionMeetingContextForSwap(
      db,
      input.termCode,
      input.sourceSectionCrn,
      input.sourceMeetingId,
    );
    if (!ctx) return { ok: false, error: "Meeting not found." };
    if (
      ctx.subject !== item.subject ||
      ctx.courseNumber !== item.courseNumber
    ) {
      return { ok: false, error: "Meeting does not match this planner course." };
    }

    const ghosts = await listSameTypeSwapGhostMeetings(db, {
      termCode: input.termCode,
      subject: item.subject,
      courseNumber: item.courseNumber,
      excludeSectionCrn: input.sourceSectionCrn,
      sourceScheduleTypeDescription: null,
      sourceScheduleTypeKey: normalizeScheduleTypeKey(
        ctx.scheduleTypeDescription,
      ),
      sourceMeetingScheduleType: ctx.meetingScheduleType,
    });
    return { ok: true, ghosts };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

export async function commitPlannerSwapFromCalendarAction(input: {
  termCode: string;
  plannerItemId: number;
  targetCrn: string;
  sourceSectionCrn: string;
  sourceMeetingId: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionId = await requireSessionId();
    const db = createDb();
    const resolved = await resolvePlannerSwapCommit(db, sessionId, {
      termCode: input.termCode,
      plannerItemId: input.plannerItemId,
      targetCrn: input.targetCrn,
      sourceSectionCrn: input.sourceSectionCrn,
      sourceMeetingId: input.sourceMeetingId,
    });
    if (!resolved.ok) return resolved;

    return updatePlannerItemSelectionAction({
      itemId: input.plannerItemId,
      termCode: input.termCode,
      anchorCrn: resolved.anchorCrn,
      selectionKind: resolved.selectionKind,
      linkedBundleId: resolved.linkedBundleId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

/**
 * Slim payload for client refresh after a calendar edit — avoids a full RSC
 * `router.refresh()` round trip (terms, layout, large prefetch re-serialize).
 */
export async function loadPlannerCalendarStateAction(termCode: string): Promise<
  | {
      ok: true;
      plannerItems: PlannerItemRow[];
      calendarBlocks: CalendarBlock[];
      swapGhostsPrefetch: Record<string, SwapGhostMeeting[]>;
    }
  | { ok: false; error: string }
> {
  try {
    const sessionId = await requireSessionId();
    if (!termCode) return { ok: false, error: "Missing term." };
    const db = createDb();
    const plannerItems = await listPlannerItems(db, sessionId, termCode);
    const calendarBlocks = await buildCalendarBlocks(
      db,
      sessionId,
      termCode,
      plannerItems,
    );
    const swapGhostsPrefetch =
      calendarBlocks.length > 0
        ? await buildSwapGhostsPrefetchMap(db, termCode, calendarBlocks)
        : {};
    return {
      ok: true,
      plannerItems,
      calendarBlocks,
      swapGhostsPrefetch,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}
