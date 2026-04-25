import type {
  FetchLinkedSectionsResponse,
  SearchResultsRow,
} from "@/lib/banner-ssb/types";

export type LinkedEntry = { fetchedAt: string; response: unknown };

type SectionsTermFile = {
  bySubject?: Record<string, { rows?: SearchResultsRow[]; pages?: unknown[] }>;
};

export type TermCatalogBundle = {
  termCode: string;
  termDescription?: string;
  sectionRows: SearchResultsRow[];
  courses: Map<string, SearchResultsRow[]>;
  linkedByCrn: Map<string, LinkedEntry>;
};

export function flattenSectionRows(data: SectionsTermFile): SearchResultsRow[] {
  const out: SearchResultsRow[] = [];
  if (!data.bySubject) return out;
  for (const v of Object.values(data.bySubject)) {
    if (v.rows?.length) out.push(...v.rows);
  }
  return out;
}

export function courseKeyFromRow(row: SearchResultsRow): string | null {
  const sub = row.subject;
  const num = row.courseNumber;
  if (typeof sub !== "string" || !sub) return null;
  if (typeof num !== "string" && typeof num !== "number") return null;
  const numStr = String(num);
  if (!numStr) return null;
  return `${sub}|${numStr}`;
}

export function groupSectionsByCourse(
  rows: SearchResultsRow[]
): Map<string, SearchResultsRow[]> {
  const map = new Map<string, SearchResultsRow[]>();
  for (const row of rows) {
    const key = courseKeyFromRow(row);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  const keys = [...map.keys()].sort((a, b) => a.localeCompare(b));
  const ordered = new Map<string, SearchResultsRow[]>();
  for (const k of keys) ordered.set(k, map.get(k)!);
  return ordered;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export function parseLinkedResponse(
  response: unknown
): FetchLinkedSectionsResponse | null {
  if (!isRecord(response)) return null;
  return response as FetchLinkedSectionsResponse;
}

export function sectionSummaryLine(row: SearchResultsRow): string {
  const r = row as Record<string, unknown>;
  const crn = row.courseReferenceNumber;
  const seq = r.sequenceNumber;
  const title =
    (typeof r.courseTitle === "string" && r.courseTitle) ||
    (typeof r.subjectCourse === "string" && r.subjectCourse) ||
    null;
  const parts = [
    typeof crn === "string" ? `CRN ${crn}` : null,
    seq != null && seq !== "" ? `seq ${String(seq)}` : null,
    title,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "(section)";
}
