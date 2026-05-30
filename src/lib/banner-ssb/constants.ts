/** Default Chrome-like UA; Banner may block obvious bot defaults. */
export const BANNER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const SUBJECT_PAGE_SIZE = 100;
export const SEARCH_RESULTS_PAGE_SIZE = 500;
export const MAX_SEARCH_RESULT_PAGES = 250;
export const TERMS_MAX = 500;
export const RETRY_ATTEMPTS = 4;
export const RETRY_BASE_MS = 1500;

/** Base delay between Banner requests on the hot scrape path. */
const BANNER_POLITENESS_BASE_MS = 120;
/** Random jitter (+/-) applied to politeness base delay. */
const BANNER_POLITENESS_JITTER_MS = 80;

function bannerPolitenessDelayMs(): number {
  const jitter =
    Math.floor(Math.random() * (BANNER_POLITENESS_JITTER_MS * 2 + 1)) -
    BANNER_POLITENESS_JITTER_MS;
  return Math.max(0, BANNER_POLITENESS_BASE_MS + jitter);
}

export async function bannerPolitenessDelay(): Promise<number> {
  const ms = bannerPolitenessDelayMs();
  if (ms <= 0) return 0;
  await new Promise((r) => setTimeout(r, ms));
  return ms;
}
