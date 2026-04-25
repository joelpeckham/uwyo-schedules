export const BANNER_ORIGIN = "https://wyossb.uwyo.edu";
export const BANNER_SSB_PREFIX = `${BANNER_ORIGIN}/StudentRegistrationSsb/ssb`;

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const SUBJECT_PAGE_SIZE = 100;
export const SEARCH_RESULTS_PAGE_SIZE = 500;
export const MAX_SEARCH_RESULT_PAGES_PER_SUBJECT = 250;

export const FETCH_TIMEOUT_MS = 120_000;

const parsedLinked = parseInt(process.env.LINKED_CRNS_PER_STEP ?? "15", 10);

/**
 * Representative CRNs to fetch per `bannerFetchLinkedBatchStep` (one Banner session per batch).
 * Override with env `LINKED_CRNS_PER_STEP`. Tune down if steps hit memory/timeout limits.
 */
export const LINKED_CRNS_PER_STEP =
  Number.isFinite(parsedLinked) && parsedLinked > 0 ? parsedLinked : 15;
