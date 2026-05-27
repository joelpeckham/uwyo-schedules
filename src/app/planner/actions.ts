"use server";

/**
 * Planner server actions: catalog/solve/search only. Per-user planner cart,
 * blackouts live in browser localStorage (`planner:v2`).
 */

import { createDb } from "@/db/index";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import type { PlannerScheduleFilters } from "@/lib/planner/schedule-filters";
import type { CourseSolvePack } from "@/lib/planner/solve-schedules-core";
import type { SolveSchedulesResult } from "@/lib/planner/solve-schedules";
import {
  loadCourseSolvePack,
  solveSchedulesForTerm,
} from "@/lib/planner/solve-schedules";
import { cookies } from "next/headers";
import {
  parseBlackoutsJson,
  type PlannerBlackoutsDocV1,
} from "@/lib/planner/blackouts";
import { loadPlannerCatalogForItems } from "@/lib/planner/catalog-bootstrap";
import { ensureSectionDescriptions } from "@/lib/planner/ensure-section-descriptions";
import { sanitizeSectionRawJson } from "@/lib/planner/section-detail-sanitize";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import { catalogActionClientKey } from "@/lib/planner/catalog-action-client-key";
import { takeCatalogActionRateLimit } from "@/lib/planner/catalog-action-rate-limit";
import {
  getSectionDetail,
  searchCourses,
  type CourseSearchRow,
  type PlannerItemRow,
} from "@/lib/planner/data";
import {
  PLANNER_SESSION_COOKIE,
  UUID_RE,
} from "@/lib/planner/constants";
import type { PlannerTermLocalState } from "@/lib/planner/local-state";

async function readSessionIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(PLANNER_SESSION_COOKIE)?.value;
  if (!raw || !UUID_RE.test(raw)) return null;
  return raw;
}

/**
 * One-shot migration: read legacy Postgres planner state for this session,
 * return it grouped by term, then delete those rows.
 */
export async function migratePlannerStateFromServerAction(): Promise<
  | { ok: true; terms: Record<string, PlannerTermLocalState> }
  | { ok: false; error: string }
> {
  try {
    const sessionId = await readSessionIdFromCookie();
    if (!sessionId) {
      return { ok: true, terms: {} };
    }
    const db = createDb();

    const itemRows = await db
      .select()
      .from(schema.plannerItems)
      .where(eq(schema.plannerItems.sessionId, sessionId));

    const uiRows = await db
      .select()
      .from(schema.plannerTermUiState)
      .where(eq(schema.plannerTermUiState.sessionId, sessionId));

    const terms: Record<string, PlannerTermLocalState> = {};

    for (const row of uiRows) {
      terms[row.termCode] = {
        items: [],
        blackouts: parseBlackoutsJson(row.blackouts),
        lastSolutionIndex: row.lastSolutionIndex,
      };
    }

    for (const row of itemRows) {
      const t = terms[row.termCode] ?? {
        items: [],
        blackouts: { v: 1, items: [] } satisfies PlannerBlackoutsDocV1,
        lastSolutionIndex: 0,
      };
      t.items.push(row);
      terms[row.termCode] = t;
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(schema.plannerItems)
        .where(eq(schema.plannerItems.sessionId, sessionId));
      await tx
        .delete(schema.plannerTermUiState)
        .where(eq(schema.plannerTermUiState.sessionId, sessionId));
    });

    return { ok: true, terms };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

export async function solveSchedulesAction(
  termCode: string,
  items: PlannerItemRow[],
  filters: PlannerScheduleFilters,
): Promise<
  | { ok: true; result: SolveSchedulesResult }
  | { ok: false; error: string }
> {
  try {
    if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
      return { ok: false, error: "Too many requests. Try again in a moment." };
    }
    if (!termCode) return { ok: false, error: "Missing term." };
    const db = createDb();
    const result = await solveSchedulesForTerm(db, termCode, items, {
      ...filters,
      maxSolutions: 25,
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
  await ensureSectionDescriptions(db, termCode, [crn]);
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
  const sanitized = sanitizeSectionRawJson(r.rawJson) ?? {};
  if (r.courseDescription) {
    sanitized.courseDescription = r.courseDescription;
  }
  if (r.sectionInformationText) {
    sanitized.sectionInformationText = r.sectionInformationText;
  }
  return { rawJson: sanitized, title };
}

/** Catalog slices for client-side calendar / swap given planner items. */
export async function loadPlannerCatalogForItemsAction(
  termCode: string,
  items: PlannerItemRow[],
): Promise<
  | { ok: true; catalog: PlannerCatalogJson }
  | { ok: false; error: string }
> {
  try {
    if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
      return { ok: false, error: "Too many requests. Try again in a moment." };
    }
    if (!termCode) return { ok: false, error: "Missing term." };
    const db = createDb();
    const { catalog } = await loadPlannerCatalogForItems(db, termCode, items);
    return { ok: true, catalog };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}
