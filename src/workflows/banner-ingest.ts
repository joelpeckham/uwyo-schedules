import { createDb } from "@/db";
import { BannerSsbClient } from "@/lib/banner-ssb/client";
import { scrapeFullTermToDatabase } from "@/lib/banner-ssb/scrape-full-term";

export type BannerIngestWorkflowInput = {
  mode: "hot" | "archive";
  /** When `mode=archive`, set true to run `fetchLinkedSections` per course (default false). */
  includeLinkedArchive?: boolean;
};

async function listBannerTermsStep(): Promise<{
  terms: { code: string; description: string }[];
  primaryCode: string;
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
  console.log("[banner-ingest] listBannerTermsStep");
  const client = new BannerSsbClient(origin);
  await client.warmTermSelection();
  await client.selectTermAndLoadClassSearch(primaryCode);
  const terms = await client.getTerms();
  return { terms, primaryCode };
}

async function scrapeFullTermStep(args: {
  termCode: string;
  hotRun: boolean;
  includeLinked: boolean;
}) {
  "use step";
  console.log("[banner-ingest] scrapeFullTermStep", args);
  const db = createDb();
  return scrapeFullTermToDatabase(db, args.termCode, args.hotRun, {
    includeLinked: args.includeLinked,
  });
}

export async function bannerIngestWorkflow(input: BannerIngestWorkflowInput) {
  "use workflow";
  const { terms, primaryCode } = await listBannerTermsStep();

  if (input.mode === "hot") {
    await scrapeFullTermStep({
      termCode: primaryCode,
      hotRun: true,
      includeLinked: true,
    });
    return { ok: true as const, mode: "hot" as const, primaryCode };
  }

  const includeLinked = input.includeLinkedArchive === true;
  for (const t of terms) {
    if (t.code === primaryCode) continue;
    await scrapeFullTermStep({
      termCode: t.code,
      hotRun: false,
      includeLinked,
    });
  }

  return {
    ok: true as const,
    mode: "archive" as const,
    termCount: terms.length,
  };
}
