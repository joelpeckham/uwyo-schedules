const PREFIX = "[uwyo-scrape]";

/** Structured logs for catalog scrape steps (visible in `next dev` / Vercel function logs). */
export function scrapeStepLog(
  step: string,
  detail: Record<string, unknown> = {}
): void {
  console.info(PREFIX, step, detail);
}
