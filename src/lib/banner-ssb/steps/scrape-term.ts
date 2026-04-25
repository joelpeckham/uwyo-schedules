import { BannerSsbClient } from "../banner-client";
import { scrapeStepLog } from "../scrape-log";
import type { ScrapePlanChunk, SearchResultsRow } from "../types";
import { blobPutJsonStep } from "./blob";

/** One durable step + one Blob put per term (all planned chunks for that term merged into `sections-term.json`). */
export async function bannerScrapeTermSectionsStep(input: {
  runId: string;
  termCode: string;
  chunks: ScrapePlanChunk[];
}): Promise<{ pathname: string; url: string; rowCount: number }> {
  "use step";
  const subjectCount = input.chunks.reduce(
    (n, c) => n + c.subjectCodes.length,
    0
  );
  scrapeStepLog("bannerScrapeTermSectionsStep:start", {
    runId: input.runId,
    termCode: input.termCode,
    scrapeChunks: input.chunks.length,
    subjectCount,
  });
  const client = new BannerSsbClient();
  await client.establishSessionForTerm(input.termCode);

  const bySubject: Record<
    string,
    { rows: SearchResultsRow[]; pages: unknown[] }
  > = {};
  let totalRows = 0;

  for (const chunk of input.chunks) {
    for (const subject of chunk.subjectCodes) {
      await client.resetDataForm();
      const { rows, pages } = await client.fetchAllSearchResultsForSubject(
        input.termCode,
        subject
      );
      bySubject[subject] = { rows, pages };
      totalRows += rows.length;
    }
  }

  const pathname = `catalog-runs/${input.runId}/${input.termCode}/sections-term.json`;
  const payload = {
    schemaVersion: 1 as const,
    runId: input.runId,
    termCode: input.termCode,
    aggregation: "term" as const,
    scrapedAt: new Date().toISOString(),
    bySubject,
  };
  const { url } = await blobPutJsonStep(pathname, payload);
  scrapeStepLog("bannerScrapeTermSectionsStep:done", {
    runId: input.runId,
    termCode: input.termCode,
    subjectCount,
    rowCount: totalRows,
    pathname,
  });
  return { pathname, url, rowCount: totalRows };
}
