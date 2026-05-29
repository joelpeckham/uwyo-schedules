"use server";

/**
 * Planner server actions: catalog/solve/search only. Per-user planner cart,
 * blackouts live in browser localStorage (`planner:v2`).
 */

import { createDb } from "@/db/index";
import type { PlannerScheduleFilters } from "@/lib/planner/schedule-filters";
import type { CourseSolvePack } from "@/lib/planner/solve-schedules-core";
import type { SolveSchedulesResult } from "@/lib/planner/solve-schedules";
import {
  loadCourseSolvePack,
  solveSchedulesForTerm,
} from "@/lib/planner/solve-schedules";
import {
  blackoutsDocToTimeIntervals,
  parseBlackoutsJson,
  type PlannerBlackoutsDocV1,
} from "@/lib/planner/blackouts";
import {
  loadPlannerCatalogCore,
  loadPlannerCatalogExamEnrichment,
} from "@/lib/planner/catalog-bootstrap";
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

/** Avoid surfacing raw SQL / driver errors in the planner UI. */
function plannerActionErrorMessage(e: unknown): string {
  if (!(e instanceof Error)) return "Something went wrong.";
  const m = e.message;
  if (
    m.includes("Failed query") ||
    m.includes("relation ") ||
    m.includes("does not exist") ||
    m.includes("ECONNREFUSED") ||
    m.includes("connection")
  ) {
    return "Could not reach the schedule database. Try again in a moment.";
  }
  return m;
}

export async function solveSchedulesAction(
  termCode: string,
  items: PlannerItemRow[],
  filters: PlannerScheduleFilters,
  blackouts: PlannerBlackoutsDocV1,
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
      blackoutIntervals: blackoutsDocToTimeIntervals(
        parseBlackoutsJson(blackouts),
      ),
    });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: plannerActionErrorMessage(e) };
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

/** Fast catalog slice for calendar blocks and swap ghosts (no Banner fetch). */
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
    const { catalog } = await loadPlannerCatalogCore(db, termCode, items);
    return { ok: true, catalog };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

/** Exam reservation badges from section information (background enrichment). */
export async function loadPlannerCatalogExamEnrichmentAction(
  termCode: string,
  items: PlannerItemRow[],
): Promise<
  | {
      ok: true;
      examReservationsByCrn: PlannerCatalogJson["examReservationsByCrn"];
      vagueExamNoteByCrn: PlannerCatalogJson["vagueExamNoteByCrn"];
    }
  | { ok: false; error: string }
> {
  try {
    if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
      return { ok: false, error: "Too many requests. Try again in a moment." };
    }
    if (!termCode) return { ok: false, error: "Missing term." };
    const db = createDb();
    const enrichment = await loadPlannerCatalogExamEnrichment(
      db,
      termCode,
      items,
    );
    return { ok: true, ...enrichment };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}
