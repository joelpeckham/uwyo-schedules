import {
  TERM_CATALOG_BLOB_SCHEMA_VERSION,
  type TermCatalogGzipPayload,
} from "@/lib/catalog/term-catalog-file";
import { scrapeStepLog } from "../scrape-log";
import type { SearchResultsRow } from "../types";
import { readCatalogBlobJson, putCatalogGzipJson } from "./blob";

type SectionsBlob = {
  bySubject?: Record<
    string,
    { rows?: SearchResultsRow[]; pages?: unknown[] }
  >;
};

type LinkedBatchFile = {
  byCrn?: Record<string, { fetchedAt: string; response: unknown }>;
};

function mergeLinkedFromBatchFiles(
  batchPayloads: unknown[]
): Record<string, { fetchedAt: string; response: unknown }> {
  const merged: Record<string, { fetchedAt: string; response: unknown }> = {};
  for (const raw of batchPayloads) {
    if (!raw || typeof raw !== "object") continue;
    const byCrn = (raw as LinkedBatchFile).byCrn;
    if (!byCrn) continue;
    for (const [crn, entry] of Object.entries(byCrn)) {
      if (entry && typeof entry.fetchedAt === "string") {
        merged[crn] = {
          fetchedAt: entry.fetchedAt,
          response: entry.response,
        };
      }
    }
  }
  return merged;
}

/**
 * Reads section + linked batch JSON blobs, merges into one payload, gzip-uploads.
 * Uses non-step blob reads/puts to avoid nested durable steps.
 */
export async function bannerFinalizeTermCatalogGzipStep(input: {
  runId: string;
  termCode: string;
  termDescription?: string;
  sectionsPathname: string;
  linkedPathnames: string[];
}): Promise<{ pathname: string; url: string }> {
  "use step";
  scrapeStepLog("bannerFinalizeTermCatalogGzipStep:start", {
    runId: input.runId,
    termCode: input.termCode,
    sectionsPathname: input.sectionsPathname,
    linkedBatchCount: input.linkedPathnames.length,
  });

  const sections = (await readCatalogBlobJson(
    input.sectionsPathname
  )) as SectionsBlob;
  const bySubject = sections.bySubject ?? {};

  const batchPayloads: unknown[] = [];
  for (const p of input.linkedPathnames) {
    batchPayloads.push(await readCatalogBlobJson(p));
  }
  const linkedByCrn = mergeLinkedFromBatchFiles(batchPayloads);

  const builtAt = new Date().toISOString();
  const payload: TermCatalogGzipPayload = {
    schemaVersion: TERM_CATALOG_BLOB_SCHEMA_VERSION,
    runId: input.runId,
    termCode: input.termCode,
    termDescription: input.termDescription,
    builtAt,
    bySubject: bySubject as TermCatalogGzipPayload["bySubject"],
    linkedByCrn,
  };

  const pathname = `catalog-runs/${input.runId}/${input.termCode}/catalog.json.gz`;
  const { url, pathname: outPath } = await putCatalogGzipJson(pathname, payload);

  scrapeStepLog("bannerFinalizeTermCatalogGzipStep:done", {
    runId: input.runId,
    termCode: input.termCode,
    pathname: outPath,
    subjectKeys: Object.keys(bySubject).length,
    linkedCrnCount: Object.keys(linkedByCrn).length,
  });

  return { pathname: outPath, url };
}
