import { BANNER_ORIGIN } from "../constants";
import { BannerSsbClient } from "../banner-client";
import { scrapeStepLog } from "../scrape-log";
import type { ScrapePlan, ScrapePlanChunk } from "../types";

/** Banner lists subjects 100/page; scrape chunk size can be larger to cut workflow step count (~140 max subjects/term → one chunk). */
const CHUNK_SIZE = 200;

function parseFirstTermOption(html: string): string {
  const opt = html.match(/<option[^>]+value=["'](\d{6})["']/i);
  if (!opt) {
    throw new Error("Could not find term <option value=\"######\"> on term selection page");
  }
  return opt[1];
}

export async function bannerBuildPlanStep(input: {
  runId: string;
  termCodes?: string[];
}): Promise<ScrapePlan> {
  "use step";
  scrapeStepLog("bannerBuildPlanStep:start", {
    runId: input.runId,
    termCodesFilter: input.termCodes ?? null,
  });
  const client = new BannerSsbClient();
  const { html } = await client.getTermSelectionHtml();
  const bootstrapTerm = input.termCodes?.[0] ?? parseFirstTermOption(html);

  await client.postTermSearch(bootstrapTerm);
  await client.getClassSearchHtml();
  const terms = await client.getTerms();
  const filter = input.termCodes;
  const selectedTerms =
    filter && filter.length
      ? terms.filter((t) => filter.includes(t.code))
      : terms;
  if (!selectedTerms.length) {
    throw new Error("No terms matched termCodes filter (or getTerms empty)");
  }

  const chunks: ScrapePlanChunk[] = [];

  for (const term of selectedTerms) {
    await client.establishSessionForTerm(term.code);
    const subjects: string[] = [];
    let offset = 1;
    for (;;) {
      const page = await client.getSubjectPage(term.code, offset);
      if (!page.length) break;
      for (const s of page) {
        if (s.code) subjects.push(s.code);
      }
      offset += 1;
    }
    for (let i = 0; i < subjects.length; i += CHUNK_SIZE) {
      chunks.push({
        chunkId: `${term.code}-${Math.floor(i / CHUNK_SIZE)}`,
        termCode: term.code,
        subjectCodes: subjects.slice(i, i + CHUNK_SIZE),
      });
    }
  }

  const plan: ScrapePlan = {
    runId: input.runId,
    origin: BANNER_ORIGIN,
    terms: selectedTerms,
    chunks,
  };

  const perTerm = selectedTerms.map((t) => {
    const termChunks = chunks.filter((c) => c.termCode === t.code);
    const subjectCount = termChunks.reduce(
      (sum, c) => sum + c.subjectCodes.length,
      0
    );
    return {
      term: t.code,
      description: t.description ?? null,
      subjectCount,
      scrapeChunks: termChunks.length,
    };
  });

  scrapeStepLog("bannerBuildPlanStep:done", {
    runId: input.runId,
    origin: BANNER_ORIGIN,
    termCount: selectedTerms.length,
    totalScrapeChunks: chunks.length,
    perTerm,
  });
  return plan;
}
