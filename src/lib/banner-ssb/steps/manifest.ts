import { scrapeStepLog } from "../scrape-log";
import type { CatalogManifest } from "../types";
import { blobPutJsonStep } from "./blob";

export type CatalogRunArtifact = { path: string; url: string; kind: string };

export async function bannerFinalizeManifestStep(input: {
  runId: string;
  origin: string;
  terms: { code: string; description?: string }[];
  startedAt: string;
  /** Inventory of Blob objects for this run (maintained in the workflow — avoids `list()`). */
  artifacts: CatalogRunArtifact[];
}): Promise<{ url: string }> {
  "use step";
  scrapeStepLog("bannerFinalizeManifestStep:start", {
    runId: input.runId,
    termCount: input.terms.length,
    artifactCount: input.artifacts.length,
  });
  const manifest: CatalogManifest = {
    schemaVersion: 1,
    runId: input.runId,
    origin: input.origin,
    startedAt: input.startedAt,
    completedAt: new Date().toISOString(),
    terms: input.terms,
    blobs: input.artifacts.map((b) => ({
      path: b.path,
      url: b.url,
      kind: b.kind,
    })),
  };
  const { url } = await blobPutJsonStep(
    `catalog-runs/${input.runId}/manifest.json`,
    manifest
  );
  await blobPutJsonStep(`catalog-runs/catalog-latest.json`, {
    schemaVersion: 1 as const,
    runId: input.runId,
    manifestUrl: url,
    updatedAt: manifest.completedAt,
  });
  const kindCounts = manifest.blobs.reduce<Record<string, number>>(
    (acc, b) => {
      acc[b.kind] = (acc[b.kind] ?? 0) + 1;
      return acc;
    },
    {}
  );
  scrapeStepLog("bannerFinalizeManifestStep:done", {
    runId: input.runId,
    artifactObjects: input.artifacts.length,
    kindCounts,
    manifestUrl: url,
    completedAt: manifest.completedAt,
  });
  return { url };
}
