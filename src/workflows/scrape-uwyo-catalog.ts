import { LINKED_CRNS_PER_STEP } from "@/lib/banner-ssb/constants";
import { scrapeStepLog } from "@/lib/banner-ssb/scrape-log";
import {
  bannerBuildLinkedWorklistFromPathsStep,
  bannerFetchLinkedBatchStep,
} from "@/lib/banner-ssb/steps/linked";
import { bannerFinalizeTermCatalogGzipStep } from "@/lib/banner-ssb/steps/term-catalog-gzip";
import {
  bannerFinalizeManifestStep,
  type CatalogRunArtifact,
} from "@/lib/banner-ssb/steps/manifest";
import { bannerBuildPlanStep } from "@/lib/banner-ssb/steps/plan";
import { bannerScrapeTermSectionsStep } from "@/lib/banner-ssb/steps/scrape-term";
import { newRunIdStep } from "@/lib/banner-ssb/steps/run-id";

export type ScrapeCatalogInput = {
  /** If omitted, all terms returned by getTerms are scraped. */
  termCodes?: string[];
  /** If omitted, a new UUID is generated. */
  runId?: string;
  /** Limit chunks for smoke tests (optional). */
  maxChunks?: number;
};

export async function scrapeUwyoCatalogWorkflow(input: ScrapeCatalogInput = {}) {
  "use workflow";
  const startedAt = new Date().toISOString();
  const runId = input.runId ?? (await newRunIdStep());
  scrapeStepLog("scrapeUwyoCatalogWorkflow:run", {
    runId,
    termCodesFilter: input.termCodes ?? null,
    maxChunks: input.maxChunks ?? null,
    linkedCrnsPerStep: LINKED_CRNS_PER_STEP,
  });

  const plan = await bannerBuildPlanStep({
    runId,
    termCodes: input.termCodes,
  });

  const artifacts: CatalogRunArtifact[] = [];

  const chunks =
    input.maxChunks != null
      ? plan.chunks.slice(0, input.maxChunks)
      : plan.chunks;

  scrapeStepLog("scrapeUwyoCatalogWorkflow:scraping_sections", {
    runId,
    scrapeChunks: chunks.length,
    totalChunksInPlan: plan.chunks.length,
    termCodes: plan.terms.map((t) => t.code),
  });

  const pathsByTerm = new Map<string, string[]>();

  for (const t of plan.terms) {
    const termChunks = chunks.filter((c) => c.termCode === t.code);
    if (!termChunks.length) continue;
    const r = await bannerScrapeTermSectionsStep({
      runId,
      termCode: t.code,
      chunks: termChunks,
    });
    pathsByTerm.set(t.code, [r.pathname]);
    artifacts.push({
      path: r.pathname,
      url: r.url,
      kind: "sections",
    });
  }

  scrapeStepLog("scrapeUwyoCatalogWorkflow:sections_done", {
    runId,
    scrapeChunks: chunks.length,
  });

  for (const t of plan.terms) {
    const termCode = t.code;
    const paths = pathsByTerm.get(termCode) ?? [];
    if (!paths.length) continue;

    const crns = await bannerBuildLinkedWorklistFromPathsStep({
      runId,
      termCode,
      pathnames: paths,
    });
    const batchCount = Math.ceil(crns.length / LINKED_CRNS_PER_STEP) || 0;
    scrapeStepLog("scrapeUwyoCatalogWorkflow:linked_batches", {
      runId,
      termCode,
      representativeCrns: crns.length,
      batchCount,
      crnsPerBatch: LINKED_CRNS_PER_STEP,
    });
    let batchIndex = 0;
    const linkedPathnames: string[] = [];
    for (let i = 0; i < crns.length; i += LINKED_CRNS_PER_STEP) {
      const batch = crns.slice(i, i + LINKED_CRNS_PER_STEP);
      const { blobRefs } = await bannerFetchLinkedBatchStep({
        runId,
        termCode,
        crns: batch,
        batchIndex: batchIndex++,
      });
      for (const ref of blobRefs) {
        linkedPathnames.push(ref.pathname);
        artifacts.push({
          path: ref.pathname,
          url: ref.url,
          kind: "linked",
        });
      }
    }

    const sectionsPath = paths[0];
    if (sectionsPath) {
      const termMeta = plan.terms.find((x) => x.code === termCode);
      const gz = await bannerFinalizeTermCatalogGzipStep({
        runId,
        termCode,
        termDescription: termMeta?.description,
        sectionsPathname: sectionsPath,
        linkedPathnames,
      });
      artifacts.push({
        path: gz.pathname,
        url: gz.url,
        kind: "termCatalog",
      });
    }
  }

  scrapeStepLog("scrapeUwyoCatalogWorkflow:linked_done", {
    runId,
    termCodes: plan.terms.map((x) => x.code),
  });

  await bannerFinalizeManifestStep({
    runId,
    origin: plan.origin,
    terms: plan.terms,
    startedAt,
    artifacts,
  });

  scrapeStepLog("scrapeUwyoCatalogWorkflow:complete", {
    runId,
    termCount: plan.terms.length,
    chunkCount: chunks.length,
    artifactCount: artifacts.length,
  });

  return {
    runId,
    termCount: plan.terms.length,
    chunkCount: chunks.length,
    origin: plan.origin,
  };
}
