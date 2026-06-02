/**
 * Browser-local planner state (items, blackouts, solution index).
 * Source of truth for the planner UI.
 */

import type { PlannerBlackoutsDocV1 } from "@/lib/planner/blackouts";
import { parseBlackoutsJson } from "@/lib/planner/blackouts";
import type { PlannerItemRow } from "@/lib/planner/data";
import { defaultInstructorPrefs } from "@/lib/planner/instructor-prefs";
import {
  parseItemScheduleFilters,
  serializeItemScheduleFilters,
} from "@/lib/planner/schedule-filters";

export const PLANNER_LOCAL_STORAGE_KEY = "uwyoschedule:planner:v2";

export const DUPLICATE_COURSE_ERROR =
  "That course is already on your planner.";

type PlannerTermLocalState = {
  items: PlannerItemRow[];
  blackouts: PlannerBlackoutsDocV1;
  lastSolutionIndex: number;
  /** Cached display titles keyed by `${subject}\u0000${courseNumber}`. */
  titles: Record<string, string>;
};

type PlannerLocalDoc = {
  v: 2;
  nextId: number;
  terms: Record<string, PlannerTermLocalState>;
};

const EMPTY_BLACKOUTS: PlannerBlackoutsDocV1 = { v: 1, items: [] };

function emptyTermState(): PlannerTermLocalState {
  return {
    items: [],
    blackouts: EMPTY_BLACKOUTS,
    lastSolutionIndex: 0,
    titles: {},
  };
}

function parseTitlesMap(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== "string" || !key.trim()) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

function freshDoc(): PlannerLocalDoc {
  return { v: 2, nextId: 1, terms: {} };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Stable key for subject + course number (duplicate detection, title cache). */
export function plannerCourseTitleKey(
  subject: string,
  courseNumber: string,
): string {
  return `${subject}\u0000${courseNumber}`;
}

/** Ensure legacy localStorage rows have per-course schedule filters. */
function normalizePlannerItem(raw: unknown): PlannerItemRow | null {
  if (!isRecord(raw)) return null;
  const id =
    typeof raw.id === "number" && Number.isFinite(raw.id) ? Math.floor(raw.id) : null;
  if (id == null) return null;
  const subject = typeof raw.subject === "string" ? raw.subject : "";
  const courseNumber =
    typeof raw.courseNumber === "string" ? raw.courseNumber : "";
  const displayColor =
    typeof raw.displayColor === "string" ? raw.displayColor : "#888888";
  const termCode = typeof raw.termCode === "string" ? raw.termCode : "";
  const selectionKind =
    raw.selectionKind === "single_crn" ||
    raw.selectionKind === "linked_bundle" ||
    raw.selectionKind === "unresolved"
      ? raw.selectionKind
      : "unresolved";
  return {
    id,
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : "",
    termCode,
    subject,
    courseNumber,
    displayColor,
    selectionKind,
    anchorCrn:
      typeof raw.anchorCrn === "string" || raw.anchorCrn === null
        ? raw.anchorCrn
        : null,
    linkedBundleId:
      typeof raw.linkedBundleId === "number" && Number.isFinite(raw.linkedBundleId)
        ? Math.floor(raw.linkedBundleId)
        : null,
    instructorPrefs: raw.instructorPrefs ?? defaultInstructorPrefs(),
    sectionPins: raw.sectionPins ?? { v: 1, byType: {} },
    scheduleFilters: serializeItemScheduleFilters(
      parseItemScheduleFilters(raw.scheduleFilters),
    ),
  } as PlannerItemRow;
}

export function normalizePlannerItems(items: unknown): PlannerItemRow[] {
  if (!Array.isArray(items)) return [];
  const out: PlannerItemRow[] = [];
  for (const raw of items) {
    const row = normalizePlannerItem(raw);
    if (row) out.push(row);
  }
  return out;
}

function parseDoc(raw: unknown): PlannerLocalDoc | null {
  if (!isRecord(raw) || raw.v !== 2) return null;
  const nextId =
    typeof raw.nextId === "number" && Number.isFinite(raw.nextId) && raw.nextId >= 1
      ? Math.floor(raw.nextId)
      : 1;
  const terms: Record<string, PlannerTermLocalState> = {};
  if (isRecord(raw.terms)) {
    for (const [termCode, termRaw] of Object.entries(raw.terms)) {
      if (!termCode.trim() || !isRecord(termRaw)) continue;
      const items = normalizePlannerItems(termRaw.items);
      terms[termCode] = {
        items,
        blackouts: parseBlackoutsJson(termRaw.blackouts),
        lastSolutionIndex:
          typeof termRaw.lastSolutionIndex === "number" &&
          Number.isFinite(termRaw.lastSolutionIndex)
            ? Math.max(0, Math.floor(termRaw.lastSolutionIndex))
            : 0,
        titles: parseTitlesMap(termRaw.titles),
      };
    }
  }
  return { v: 2, nextId, terms };
}

function plannerCourseKey(subject: string, courseNumber: string): string {
  return plannerCourseTitleKey(subject, courseNumber);
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

function writeLocalDoc(doc: PlannerLocalDoc): void {
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
    titles: partial.titles ?? prev.titles,
  };
  writeLocalDoc(doc);
}

/** Merge display titles into the term doc (non-empty values only). */
export function writeTitles(
  termCode: string,
  patch: Record<string, string>,
): void {
  const doc = readLocalDoc();
  const prev = doc.terms[termCode] ?? emptyTermState();
  const titles = { ...prev.titles };
  for (const [key, value] of Object.entries(patch)) {
    const trimmed = value.trim();
    if (trimmed) titles[key] = trimmed;
  }
  writeTerm(termCode, { titles });
}

/** Replace a term's planner cart from a server share payload. */
export function replaceTermFromShare(
  termCode: string,
  state: {
    items: PlannerItemRow[];
    blackouts: PlannerBlackoutsDocV1;
  },
): void {
  const doc = readLocalDoc();
  const maxId = state.items.reduce((m, i) => Math.max(m, i.id), 0);
  if (doc.nextId <= maxId) {
    doc.nextId = maxId + 1;
  }
  const prev = doc.terms[termCode] ?? emptyTermState();
  doc.terms[termCode] = {
    items: state.items,
    blackouts: state.blackouts,
    lastSolutionIndex: 0,
    titles: prev.titles,
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

export function subscribeLocalDoc(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === PLANNER_LOCAL_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
