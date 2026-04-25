import type { SearchResultsRow } from "@/lib/banner-ssb/types";
import {
  flattenSectionRows,
  groupSectionsByCourse,
  type LinkedEntry,
  type TermCatalogBundle,
} from "./bundle";

/** Gzip term catalog blob written by the scrape workflow (JSON after gunzip). */
export const TERM_CATALOG_BLOB_SCHEMA_VERSION = 2 as const;

export type TermCatalogGzipPayload = {
  schemaVersion: typeof TERM_CATALOG_BLOB_SCHEMA_VERSION;
  runId: string;
  termCode: string;
  termDescription?: string;
  builtAt: string;
  bySubject: Record<
    string,
    { rows: SearchResultsRow[]; pages?: unknown[] }
  >;
  linkedByCrn: Record<string, { fetchedAt: string; response: unknown }>;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export function linkedMapFromRecord(
  rec: Record<string, { fetchedAt: string; response: unknown }>
): Map<string, LinkedEntry> {
  const m = new Map<string, LinkedEntry>();
  for (const [crn, entry] of Object.entries(rec)) {
    if (entry && typeof entry.fetchedAt === "string") {
      m.set(crn, { fetchedAt: entry.fetchedAt, response: entry.response });
    }
  }
  return m;
}

/**
 * Pure parse of merged term catalog JSON (after gunzip). Safe on server or client.
 */
export function parseTermCatalogPayload(
  data: unknown,
  fallback?: { termDescription?: string }
):
  | { ok: true; bundle: TermCatalogBundle }
  | { ok: false; message: string } {
  if (!isRecord(data)) {
    return { ok: false, message: "Catalog payload is not an object" };
  }
  if (data.schemaVersion !== TERM_CATALOG_BLOB_SCHEMA_VERSION) {
    return {
      ok: false,
      message: `Expected schemaVersion ${TERM_CATALOG_BLOB_SCHEMA_VERSION}`,
    };
  }
  const termCode = data.termCode;
  if (typeof termCode !== "string" || !termCode) {
    return { ok: false, message: "Missing termCode" };
  }
  const bySubject = data.bySubject;
  if (!isRecord(bySubject)) {
    return { ok: false, message: "Missing or invalid bySubject" };
  }
  const linkedRaw = data.linkedByCrn;
  const linkedRec =
    linkedRaw && isRecord(linkedRaw)
      ? (linkedRaw as Record<string, { fetchedAt: string; response: unknown }>)
      : {};
  const sectionRows = flattenSectionRows({
    bySubject: bySubject as Record<
      string,
      { rows?: SearchResultsRow[]; pages?: unknown[] }
    >,
  });
  const termDescription =
    (typeof data.termDescription === "string" && data.termDescription) ||
    fallback?.termDescription;

  return {
    ok: true,
    bundle: {
      termCode,
      termDescription,
      sectionRows,
      courses: groupSectionsByCourse(sectionRows),
      linkedByCrn: linkedMapFromRecord(linkedRec),
    },
  };
}
