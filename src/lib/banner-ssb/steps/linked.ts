import {
  BannerSsbClient,
  buildLinkedRepresentativeCrns,
} from "../banner-client";
import { scrapeStepLog } from "../scrape-log";
import type { SearchResultsRow } from "../types";
import { blobFetchJsonStep, putCatalogJson } from "./blob";

type ChunkFile = {
  bySubject?: Record<string, { rows?: SearchResultsRow[] }>;
};

/**
 * Merge section rows from one or more section JSON blobs (chunk or whole-term shape).
 * Avoids `list()` — caller passes exact pathnames (tracked in the workflow).
 */
export async function bannerBuildLinkedWorklistFromPathsStep(input: {
  runId: string;
  termCode: string;
  pathnames: string[];
}): Promise<string[]> {
  "use step";
  scrapeStepLog("bannerBuildLinkedWorklistFromPathsStep:start", {
    runId: input.runId,
    termCode: input.termCode,
    sectionFiles: input.pathnames.length,
  });
  if (!input.pathnames.length) {
    scrapeStepLog("bannerBuildLinkedWorklistFromPathsStep:done", {
      runId: input.runId,
      termCode: input.termCode,
      mergedSectionRows: 0,
      linkedRepresentativeCrns: 0,
    });
    return [];
  }
  const allRows: SearchResultsRow[] = [];
  for (const pathname of input.pathnames) {
    const data = (await blobFetchJsonStep(pathname)) as ChunkFile;
    if (!data.bySubject) continue;
    for (const v of Object.values(data.bySubject)) {
      if (v.rows?.length) allRows.push(...v.rows);
    }
  }
  const crns = buildLinkedRepresentativeCrns(allRows);
  scrapeStepLog("bannerBuildLinkedWorklistFromPathsStep:done", {
    runId: input.runId,
    termCode: input.termCode,
    sectionFiles: input.pathnames.length,
    mergedSectionRows: allRows.length,
    linkedRepresentativeCrns: crns.length,
  });
  return crns;
}

export type LinkedBatchBlobRef = { pathname: string; url: string };

/**
 * Fetches `fetchLinkedSections` for many CRNs in one durable step (one Banner session, sequential HTTP).
 * Writes one Blob per batch (`linked/batch-{batchIndex}.json`).
 */
export async function bannerFetchLinkedBatchStep(input: {
  runId: string;
  termCode: string;
  crns: string[];
  batchIndex: number;
}): Promise<{
  ok: number;
  failed: { crn: string; message: string }[];
  blobRefs: LinkedBatchBlobRef[];
}> {
  "use step";
  scrapeStepLog("bannerFetchLinkedBatchStep:start", {
    runId: input.runId,
    termCode: input.termCode,
    crnsInBatch: input.crns.length,
    crnsPreview: input.crns.slice(0, 5),
    batchIndex: input.batchIndex,
  });
  const client = new BannerSsbClient();
  await client.establishSessionForTerm(input.termCode);
  const failed: { crn: string; message: string }[] = [];
  let ok = 0;

  const byCrn: Record<string, { fetchedAt: string; response: unknown }> = {};
  for (const crn of input.crns) {
    try {
      const linked = await client.fetchLinkedSections(input.termCode, crn);
      byCrn[crn] = {
        fetchedAt: new Date().toISOString(),
        response: linked,
      };
      ok += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      failed.push({ crn, message });
      try {
        await client.refreshClassSearch();
      } catch {
        await client.establishSessionForTerm(input.termCode);
      }
    }
  }
  if (Object.keys(byCrn).length === 0) {
    scrapeStepLog("bannerFetchLinkedBatchStep:done", {
      runId: input.runId,
      termCode: input.termCode,
      crnsInBatch: input.crns.length,
      ok,
      failed: failed.length,
      failedSample: failed.slice(0, 5),
      blobRefs: 0,
      skippedBlobPut: true,
    });
    return { ok, failed, blobRefs: [] };
  }
  const batchPathname = `catalog-runs/${input.runId}/${input.termCode}/linked/batch-${input.batchIndex}.json`;
  const payload = {
    schemaVersion: 1 as const,
    runId: input.runId,
    termCode: input.termCode,
    batchIndex: input.batchIndex,
    fetchedAt: new Date().toISOString(),
    byCrn,
  };
  const { url, pathname: outPath } = await putCatalogJson(
    batchPathname,
    payload
  );
  scrapeStepLog("bannerFetchLinkedBatchStep:done", {
    runId: input.runId,
    termCode: input.termCode,
    crnsInBatch: input.crns.length,
    ok,
    failed: failed.length,
    failedSample: failed.slice(0, 5),
    blobRefs: 1,
  });
  return { ok, failed, blobRefs: [{ pathname: outPath, url }] };
}
