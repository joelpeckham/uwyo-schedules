"use server";

/**
 * Planner server actions: catalog/solve/search and share shortlinks. Per-user
 * planner cart and blackouts live in browser localStorage (`planner:v2`).
 */

import { createDb } from "@/db/index";
import * as schema from "@/db/schema";
import type { CourseSolvePack } from "@/lib/planner/solve-schedules-core";
import type { SolveSchedulesResult } from "@/lib/planner/solve-schedules";
import {
  loadCourseSolvePack,
  loadCourseSolvePacks,
  type CourseSolvePackInput,
  solveSchedulesForTerm,
} from "@/lib/planner/solve-schedules";
import {
  blackoutsDocToTimeIntervals,
  parseBlackoutsJson,
  type PlannerBlackoutsDocV1,
} from "@/lib/planner/blackouts";
import { MAX_PLANNER_COURSES_PER_TERM } from "@/lib/planner/constants";
import {
  loadPlannerCatalogCore,
  loadPlannerCatalogExamEnrichment,
} from "@/lib/planner/catalog-bootstrap";
import { sanitizeSectionRawJson } from "@/lib/planner/section-detail-sanitize";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import { catalogActionClientKey } from "@/lib/planner/catalog-action-client-key";
import { takeCatalogActionRateLimit } from "@/lib/planner/catalog-action-rate-limit";
import {
  generateShareCode,
  isValidShareCode,
} from "@/lib/planner/share-code";
import {
  buildSharePayload,
  parseSharePayload,
  type SharePayloadV1,
} from "@/lib/planner/share-state";
import {
  getSectionDetail,
  searchCourses,
  type CourseSearchRow,
  type PlannerItemRow,
} from "@/lib/planner/data";
import { eq } from "drizzle-orm";

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

function distinctCoursesFromItems(
  items: PlannerItemRow[],
): CourseSolvePackInput[] {
  const seen = new Map<string, CourseSolvePackInput>();
  for (const item of items) {
    const k = `${item.subject}\0${item.courseNumber}`;
    if (!seen.has(k)) {
      seen.set(k, { subject: item.subject, courseNumber: item.courseNumber });
    }
  }
  return [...seen.values()];
}

export async function solveSchedulesAction(
  termCode: string,
  items: PlannerItemRow[],
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

/** Batched solve packs for multiple courses (one server round-trip). */
export async function prefetchCourseSolvePacksAction(
  termCode: string,
  courses: CourseSolvePackInput[],
): Promise<
  { ok: true; packs: CourseSolvePack[] } | { ok: false; error: string }
> {
  try {
    if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
      return { ok: false, error: "Too many requests. Try again in a moment." };
    }
    if (!termCode.trim()) return { ok: false, error: "Missing term." };
    const normalized = courses
      .map((c) => ({
        subject: c.subject.trim(),
        courseNumber: c.courseNumber.trim(),
      }))
      .filter((c) => c.subject && c.courseNumber);
    if (normalized.length === 0) {
      return { ok: true, packs: [] };
    }
    const db = createDb();
    const packs = await loadCourseSolvePacks(db, termCode, normalized);
    return { ok: true, packs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

/** Catalog + all solve packs in one round-trip (initial planner bootstrap). */
export async function loadPlannerBootstrapAction(
  termCode: string,
  items: PlannerItemRow[],
): Promise<
  | { ok: true; catalog: PlannerCatalogJson; packs: CourseSolvePack[] }
  | { ok: false; error: string }
> {
  try {
    if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
      return { ok: false, error: "Too many requests. Try again in a moment." };
    }
    if (!termCode) return { ok: false, error: "Missing term." };
    const db = createDb();
    const courses = distinctCoursesFromItems(items);
    const [{ catalog }, packs] = await Promise.all([
      loadPlannerCatalogCore(db, termCode, items),
      loadCourseSolvePacks(db, termCode, courses),
    ]);
    return { ok: true, catalog, packs };
  } catch (e) {
    return { ok: false, error: plannerActionErrorMessage(e) };
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

export async function createShareLinkAction(input: {
  termCode: string;
  items: PlannerItemRow[];
  blackouts: PlannerBlackoutsDocV1;
}): Promise<
  | { ok: true; code: string }
  | { ok: false; error: string }
> {
  try {
    if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
      return { ok: false, error: "Too many requests. Try again in a moment." };
    }
    const termCode = input.termCode.trim();
    if (!termCode) return { ok: false, error: "Missing term." };
    if (input.items.length === 0) {
      return { ok: false, error: "Add at least one course before sharing." };
    }
    if (input.items.length > MAX_PLANNER_COURSES_PER_TERM) {
      return {
        ok: false,
        error: `At most ${MAX_PLANNER_COURSES_PER_TERM} courses for one term.`,
      };
    }

    const payload = buildSharePayload({
      termCode,
      items: input.items,
      blackouts: parseBlackoutsJson(input.blackouts),
    });
    const db = createDb();

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateShareCode();
      try {
        await db.insert(schema.plannerShares).values({
          code,
          termCode,
          payload,
        });
        return { ok: true, code };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("duplicate key") || msg.includes("unique")) {
          continue;
        }
        throw e;
      }
    }
    return { ok: false, error: "Could not create share link. Try again." };
  } catch (e) {
    return { ok: false, error: plannerActionErrorMessage(e) };
  }
}

export async function resolveShareLinkAction(
  code: string,
): Promise<
  | { ok: true; payload: SharePayloadV1 }
  | { ok: false; error: string }
> {
  try {
    if (!(await takeCatalogActionRateLimit(await catalogActionClientKey()))) {
      return { ok: false, error: "Too many requests. Try again in a moment." };
    }
    const trimmed = code.trim();
    if (!isValidShareCode(trimmed)) {
      return { ok: false, error: "Invalid share link." };
    }
    const db = createDb();
    const rows = await db
      .select({
        termCode: schema.plannerShares.termCode,
        payload: schema.plannerShares.payload,
      })
      .from(schema.plannerShares)
      .where(eq(schema.plannerShares.code, trimmed))
      .limit(1);
    const row = rows[0];
    if (!row) return { ok: false, error: "Share link not found." };

    const payload = parseSharePayload(row.payload);
    if (!payload || payload.termCode !== row.termCode) {
      return { ok: false, error: "Share link is corrupted." };
    }
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: plannerActionErrorMessage(e) };
  }
}
