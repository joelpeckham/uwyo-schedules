/**
 * Browser-local planner state (items, blackouts, solution index).
 * Source of truth for the planner UI; server Postgres rows are legacy / migration only.
 */

import type { PlannerBlackoutsDocV1 } from "@/lib/planner/blackouts";
import { parseBlackoutsJson } from "@/lib/planner/blackouts";
import type { PlannerItemRow } from "@/lib/planner/data";
import { MAX_PLANNER_COURSES_PER_TERM } from "@/lib/planner/constants";

export const PLANNER_LOCAL_STORAGE_KEY = "uwyoschedule:planner:v2";

export const DUPLICATE_COURSE_ERROR =
  "That course is already on your planner.";

export type PlannerTermLocalState = {
  items: PlannerItemRow[];
  blackouts: PlannerBlackoutsDocV1;
  lastSolutionIndex: number;
};

type PlannerLocalDoc = {
  v: 2;
  migrated: boolean;
  nextId: number;
  terms: Record<string, PlannerTermLocalState>;
};

const EMPTY_BLACKOUTS: PlannerBlackoutsDocV1 = { v: 1, items: [] };

function emptyTermState(): PlannerTermLocalState {
  return {
    items: [],
    blackouts: EMPTY_BLACKOUTS,
    lastSolutionIndex: 0,
  };
}

function freshDoc(): PlannerLocalDoc {
  return { v: 2, migrated: false, nextId: 1, terms: {} };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseDoc(raw: unknown): PlannerLocalDoc | null {
  if (!isRecord(raw) || raw.v !== 2) return null;
  const migrated = raw.migrated === true;
  const nextId =
    typeof raw.nextId === "number" && Number.isFinite(raw.nextId) && raw.nextId >= 1
      ? Math.floor(raw.nextId)
      : 1;
  const terms: Record<string, PlannerTermLocalState> = {};
  if (isRecord(raw.terms)) {
    for (const [termCode, termRaw] of Object.entries(raw.terms)) {
      if (!termCode.trim() || !isRecord(termRaw)) continue;
      const items = Array.isArray(termRaw.items)
        ? (termRaw.items as PlannerItemRow[])
        : [];
      terms[termCode] = {
        items,
        blackouts: parseBlackoutsJson(termRaw.blackouts),
        lastSolutionIndex:
          typeof termRaw.lastSolutionIndex === "number" &&
          Number.isFinite(termRaw.lastSolutionIndex)
            ? Math.max(0, Math.floor(termRaw.lastSolutionIndex))
            : 0,
      };
    }
  }
  return { v: 2, migrated, nextId, terms };
}

/** Stable key for subject + course number (duplicate detection). */
function plannerCourseKey(subject: string, courseNumber: string): string {
  return `${subject}\u0000${courseNumber}`;
}

export function plannerHasCourse(
  items: PlannerItemRow[],
  subject: string,
  courseNumber: string,
): boolean {
  const key = plannerCourseKey(subject, courseNumber);
  return items.some(
    (i) => plannerCourseKey(i.subject, i.courseNumber) === key,
  );
}

function readRawFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PLANNER_LOCAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readLocalDoc(): PlannerLocalDoc {
  const raw = readRawFromStorage();
  if (!raw) return freshDoc();
  try {
    const parsed = parseDoc(JSON.parse(raw) as unknown);
    return parsed ?? freshDoc();
  } catch {
    return freshDoc();
  }
}

export function writeLocalDoc(doc: PlannerLocalDoc): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLANNER_LOCAL_STORAGE_KEY, JSON.stringify(doc));
  } catch {
    /* quota / private mode — best effort */
  }
}

export function readTerm(termCode: string): PlannerTermLocalState {
  const doc = readLocalDoc();
  return doc.terms[termCode] ?? emptyTermState();
}

export function writeTerm(
  termCode: string,
  partial: Partial<PlannerTermLocalState>,
): void {
  const doc = readLocalDoc();
  const prev = doc.terms[termCode] ?? emptyTermState();
  doc.terms[termCode] = {
    items: partial.items ?? prev.items,
    blackouts: partial.blackouts ?? prev.blackouts,
    lastSolutionIndex:
      partial.lastSolutionIndex ?? prev.lastSolutionIndex,
  };
  writeLocalDoc(doc);
}

/** Monotonic client id for planner item rows (replaces DB serial ids). */
export function allocateNextItemId(): number {
  const doc = readLocalDoc();
  const id = doc.nextId;
  doc.nextId = id + 1;
  writeLocalDoc(doc);
  return id;
}

export function isMigrated(): boolean {
  return readLocalDoc().migrated;
}

/** Skip legacy Postgres migration on future loads (e.g. after a failed attempt). */
export function markPlannerMigrated(): void {
  const doc = readLocalDoc();
  if (doc.migrated) return;
  doc.migrated = true;
  writeLocalDoc(doc);
}

/**
 * Merge server migration payload into local storage and bump `nextId` past
 * any imported item ids.
 */
export function mergeMigrationTerms(
  terms: Record<string, PlannerTermLocalState>,
): void {
  const doc = readLocalDoc();
  let maxId = doc.nextId - 1;
  for (const [termCode, state] of Object.entries(terms)) {
    const existing = doc.terms[termCode];
    if (!existing || existing.items.length === 0) {
      doc.terms[termCode] = state;
    } else {
      const have = new Set(
        existing.items.map((i) =>
          plannerCourseKey(i.subject, i.courseNumber),
        ),
      );
      const merged = [...existing.items];
      for (const item of state.items) {
        const k = plannerCourseKey(item.subject, item.courseNumber);
        if (have.has(k)) continue;
        if (merged.length >= MAX_PLANNER_COURSES_PER_TERM) break;
        merged.push(item);
        have.add(k);
      }
      doc.terms[termCode] = {
        items: merged,
        blackouts:
          existing.blackouts.items.length > 0
            ? existing.blackouts
            : state.blackouts,
        lastSolutionIndex: existing.lastSolutionIndex || state.lastSolutionIndex,
      };
    }
    for (const item of doc.terms[termCode]!.items) {
      if (item.id > maxId) maxId = item.id;
    }
  }
  doc.nextId = Math.max(doc.nextId, maxId + 1);
  doc.migrated = true;
  writeLocalDoc(doc);
}

export function subscribeLocalDoc(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === PLANNER_LOCAL_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
