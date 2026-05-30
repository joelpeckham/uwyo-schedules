import { createDb } from "@/db";
import { BannerSsbClient } from "@/lib/banner-ssb/client";
import { scrapeFullTermToDatabase } from "@/lib/banner-ssb/scrape-full-term";
import {
  emptyDbStats,
  emptyIngestStepStats,
  logIngestWorkflowSummary,
  mergeArchiveScrapeStats,
  mergeIngestStepStats,
  type IngestStepStats,
} from "@/lib/ingest/stats";

type BannerIngestWorkflowInput = {
  mode: "hot" | "archive";
  /** When `mode=archive`, set true to run `fetchLinkedSections` per course (default false). */
  includeLinkedArchive?: boolean;
};

async function listBannerTermsStep(): Promise<{
  terms: { code: string; description: string }[];
  primaryCode: string;
  stats: IngestStepStats;
}> {
  "use step";
  const origin = process.env.BANNER_ORIGIN;
  const primaryCode = process.env.BANNER_PRIMARY_TERM_CODE;
  if (!origin) {
    throw new Error("BANNER_ORIGIN is not set");
  }
  if (!primaryCode) {
    throw new Error("BANNER_PRIMARY_TERM_CODE is not set");
  }
  if (process.env.DEBUG_INGEST === "1") {
    console.log("[banner-ingest] listBannerTermsStep");
  }
  const client = new BannerSsbClient(origin);
  await client.warmTermSelection();
  await client.selectTermAndLoadClassSearch(primaryCode);
  const terms = await client.getTerms();
  return {
    terms,
    primaryCode,
    stats: {
      banner: client.getBannerStats(),
      db: emptyDbStats(),
    },
  };
}

async function scrapeFullTermStep(args: {
  termCode: string;
  hotRun: boolean;
  includeLinked: boolean;
}): Promise<{
  subjects: number;
  sections: number;
  linkedBundles: number;
  stats: IngestStepStats;
}> {
  "use step";
  if (process.env.DEBUG_INGEST === "1") {
    console.log("[banner-ingest] scrapeFullTermStep", args);
  }
  const db = createDb();
  return scrapeFullTermToDatabase(db, args.termCode, args.hotRun, {
    includeLinked: args.includeLinked,
  });
}

export async function bannerIngestWorkflow(input: BannerIngestWorkflowInput) {
  "use workflow";
  const { terms, primaryCode, stats: termListStats } =
    await listBannerTermsStep();

  if (input.mode === "hot") {
    const scrape = await scrapeFullTermStep({
      termCode: primaryCode,
      hotRun: true,
      includeLinked: true,
    });
    const stats = mergeIngestStepStats(termListStats, scrape.stats);
    logIngestWorkflowSummary("banner-ingest", stats, {
      mode: "hot",
      primaryCode,
      termCode: primaryCode,
      subjects: scrape.subjects,
      sections: scrape.sections,
      linkedBundles: scrape.linkedBundles,
    });
    return {
      ok: true as const,
      mode: "hot" as const,
      primaryCode,
      stats,
    };
  }

  const includeLinked = input.includeLinkedArchive === true;
  let archiveStats: IngestStepStats | undefined;
  let termsScraped = 0;
  for (const t of terms) {
    if (t.code === primaryCode) continue;
    const scrape = await scrapeFullTermStep({
      termCode: t.code,
      hotRun: false,
      includeLinked,
    });
    archiveStats = mergeArchiveScrapeStats(archiveStats, scrape.stats);
    termsScraped += 1;
  }

  const stats = mergeIngestStepStats(
    termListStats,
    archiveStats ?? emptyIngestStepStats(),
  );
  logIngestWorkflowSummary("banner-ingest", stats, {
    mode: "archive",
    primaryCode,
    termsListed: terms.length,
    termsScraped,
    includeLinked,
  });

  return {
    ok: true as const,
    mode: "archive" as const,
    termCount: terms.length,
    termsScraped,
    stats,
  };
}
