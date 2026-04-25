import type { CatalogManifest, SearchResultsRow } from "@/lib/banner-ssb/types";
import {
  readCatalogBlobGzipJson,
  readCatalogBlobJson,
} from "@/lib/banner-ssb/steps/blob";
import {
  flattenSectionRows,
  groupSectionsByCourse,
  type LinkedEntry,
  type TermCatalogBundle,
} from "./bundle";
import { parseTermCatalogPayload } from "./term-catalog-file";

const LATEST_PATH = "catalog-runs/catalog-latest.json";

export type CatalogLatestPointer = {
  schemaVersion: number;
  runId: string;
  manifestUrl?: string;
  updatedAt?: string;
};

type SectionsTermFile = {
  bySubject?: Record<
    string,
    { rows?: SearchResultsRow[]; pages?: unknown[] }
  >;
};

type LinkedBatchFile = {
  byCrn?: Record<string, { fetchedAt: string; response: unknown }>;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function asManifest(x: unknown): CatalogManifest | null {
  if (!isRecord(x)) return null;
  if (x.schemaVersion !== 1) return null;
  if (typeof x.runId !== "string") return null;
  if (!Array.isArray(x.terms)) return null;
  if (!Array.isArray(x.blobs)) return null;
  return x as unknown as CatalogManifest;
}

function asLatestPointer(x: unknown): CatalogLatestPointer | null {
  if (!isRecord(x)) return null;
  if (typeof x.runId !== "string") return null;
  return x as CatalogLatestPointer;
}

export async function tryReadCatalogJson(
  pathname: string
): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  try {
    const data = await readCatalogBlobJson(pathname);
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message };
  }
}

export async function tryReadCatalogGzipJson(
  pathname: string
): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  try {
    const data = await readCatalogBlobGzipJson(pathname);
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message };
  }
}

export async function loadLatestPointer(): Promise<
  | { ok: true; pointer: CatalogLatestPointer }
  | { ok: false; message: string }
> {
  const r = await tryReadCatalogJson(LATEST_PATH);
  if (!r.ok) return { ok: false, message: r.message };
  const pointer = asLatestPointer(r.data);
  if (!pointer) return { ok: false, message: "Invalid catalog-latest.json shape" };
  return { ok: true, pointer };
}

export async function loadManifestForRun(runId: string): Promise<
  | { ok: true; manifest: CatalogManifest }
  | { ok: false; message: string }
> {
  const pathname = `catalog-runs/${runId}/manifest.json`;
  const r = await tryReadCatalogJson(pathname);
  if (!r.ok) return { ok: false, message: r.message };
  const manifest = asManifest(r.data);
  if (!manifest) return { ok: false, message: "Invalid manifest.json shape" };
  return { ok: true, manifest };
}

function manifestPathForTermSections(
  manifest: CatalogManifest,
  termCode: string
): string | null {
  const suffix = `/${termCode}/sections-term.json`;
  const hit = manifest.blobs.find(
    (b) => b.kind === "sections" && b.path.endsWith(suffix)
  );
  return hit?.path ?? null;
}

function manifestPathsForTermLinked(
  manifest: CatalogManifest,
  termCode: string
): string[] {
  const prefix = `catalog-runs/${manifest.runId}/${termCode}/linked/`;
  return manifest.blobs
    .filter((b) => b.kind === "linked" && b.path.startsWith(prefix))
    .map((b) => b.path)
    .sort();
}

/** Path to gzipped merged term catalog when present in manifest. */
export function manifestPathForTermCatalog(
  manifest: CatalogManifest,
  termCode: string
): string | null {
  const suffix = `/${termCode}/catalog.json.gz`;
  const hit = manifest.blobs.find(
    (b) => b.kind === "termCatalog" && b.path.endsWith(suffix)
  );
  return hit?.path ?? null;
}

export { flattenSectionRows, groupSectionsByCourse } from "./bundle";
export type { LinkedEntry, TermCatalogBundle } from "./bundle";

export async function mergeLinkedByCrnFromPaths(
  pathnames: string[]
): Promise<Map<string, LinkedEntry>> {
  const merged = new Map<string, LinkedEntry>();
  for (const pathname of pathnames) {
    const r = await tryReadCatalogJson(pathname);
    if (!r.ok) continue;
    const file = r.data as LinkedBatchFile;
    if (!file.byCrn) continue;
    for (const [crn, entry] of Object.entries(file.byCrn)) {
      if (entry && typeof entry.fetchedAt === "string")
        merged.set(crn, { fetchedAt: entry.fetchedAt, response: entry.response });
    }
  }
  return merged;
}

export async function loadTermCatalogBundle(input: {
  manifest: CatalogManifest;
  termCode: string;
  termDescription?: string;
}): Promise<
  | { ok: true; bundle: TermCatalogBundle }
  | { ok: false; message: string }
> {
  const gzipPath = manifestPathForTermCatalog(input.manifest, input.termCode);
  if (gzipPath) {
    const gz = await tryReadCatalogGzipJson(gzipPath);
    if (!gz.ok) return { ok: false, message: gz.message };
    const parsed = parseTermCatalogPayload(gz.data, {
      termDescription: input.termDescription,
    });
    if (!parsed.ok) return parsed;
    if (parsed.bundle.termCode !== input.termCode) {
      return {
        ok: false,
        message: `Term catalog file termCode mismatch (expected ${input.termCode}, got ${parsed.bundle.termCode})`,
      };
    }
    return {
      ok: true,
      bundle: {
        ...parsed.bundle,
        termDescription:
          parsed.bundle.termDescription ?? input.termDescription,
      },
    };
  }

  const sectionsPath = manifestPathForTermSections(
    input.manifest,
    input.termCode
  );
  if (!sectionsPath) {
    return {
      ok: false,
      message: `No term catalog or sections artifact for term ${input.termCode} in manifest`,
    };
  }
  const sectionsRes = await tryReadCatalogJson(sectionsPath);
  if (!sectionsRes.ok) return { ok: false, message: sectionsRes.message };
  const sectionRows = flattenSectionRows(sectionsRes.data as SectionsTermFile);
  const linkedPaths = manifestPathsForTermLinked(
    input.manifest,
    input.termCode
  );
  const linkedByCrn = await mergeLinkedByCrnFromPaths(linkedPaths);
  return {
    ok: true,
    bundle: {
      termCode: input.termCode,
      termDescription: input.termDescription,
      sectionRows,
      courses: groupSectionsByCourse(sectionRows),
      linkedByCrn,
    },
  };
}

export { parseLinkedResponse, sectionSummaryLine } from "./bundle";
export { parseTermCatalogPayload } from "./term-catalog-file";
