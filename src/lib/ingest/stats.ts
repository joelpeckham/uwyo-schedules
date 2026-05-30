export type BannerEndpoint =
  | "termSelection"
  | "termSearch"
  | "classSearch"
  | "getTerms"
  | "getSubject"
  | "resetDataForm"
  | "searchResults"
  | "fetchLinkedSections"
  | "getCourseDescription"
  | "other";

export type BannerCallStats = {
  total: number;
  retries: number;
  byEndpoint: Partial<Record<BannerEndpoint, number>>;
};

export type DbCallStats = {
  selects: number;
  inserts: number;
  updates: number;
  deletes: number;
  transactions: number;
};

export type SectionSyncStats = {
  scraped: number;
  unchanged: number;
  inserted: number;
  seatOnlyUpdates: number;
  contentChanged: number;
  removed: number;
  catalogChanged: boolean;
};

export type ScrapeTermStats = {
  subjects: number;
  sections: number;
  linkedBundles: number;
  linkedCoursesSkipped: number;
  politenessDelaysMs: number;
};

export type DescriptionFetchStats = {
  crnsRequested: number;
  crnsFetched: number;
  contentChanged: number;
  timestampOnly: number;
  failures: number;
};

export type IngestStepStats = {
  banner: BannerCallStats;
  db: DbCallStats;
  sectionSync?: SectionSyncStats;
  scrape?: ScrapeTermStats;
  descriptions?: DescriptionFetchStats;
};

export function emptyBannerStats(): BannerCallStats {
  return { total: 0, retries: 0, byEndpoint: {} };
}

export function emptyDbStats(): DbCallStats {
  return {
    selects: 0,
    inserts: 0,
    updates: 0,
    deletes: 0,
    transactions: 0,
  };
}

export function emptyIngestStepStats(): IngestStepStats {
  return { banner: emptyBannerStats(), db: emptyDbStats() };
}

export function classifyBannerEndpoint(
  url: string,
  ssbBase: string,
): BannerEndpoint {
  const path = url.startsWith(ssbBase)
    ? url.slice(ssbBase.length)
    : new URL(url, "http://local").pathname;

  if (path.includes("/term/termSelection")) return "termSelection";
  if (path.includes("/term/search")) return "termSearch";
  if (path.includes("/classSearch/classSearch")) return "classSearch";
  if (path.includes("/classSearch/getTerms")) return "getTerms";
  if (path.includes("/classSearch/get_subject")) return "getSubject";
  if (path.includes("/classSearch/resetDataForm")) return "resetDataForm";
  if (path.includes("/searchResults/searchResults")) return "searchResults";
  if (path.includes("/searchResults/fetchLinkedSections")) {
    return "fetchLinkedSections";
  }
  if (path.includes("/searchResults/getCourseDescription")) {
    return "getCourseDescription";
  }
  return "other";
}

export function recordBannerRequest(
  stats: BannerCallStats,
  url: string,
  ssbBase: string,
): void {
  stats.total += 1;
  const endpoint = classifyBannerEndpoint(url, ssbBase);
  stats.byEndpoint[endpoint] = (stats.byEndpoint[endpoint] ?? 0) + 1;
}

function mergeBannerStats(
  a: BannerCallStats,
  b: BannerCallStats,
): BannerCallStats {
  const byEndpoint: Partial<Record<BannerEndpoint, number>> = {
    ...a.byEndpoint,
  };
  for (const [endpoint, count] of Object.entries(b.byEndpoint) as [
    BannerEndpoint,
    number,
  ][]) {
    byEndpoint[endpoint] = (byEndpoint[endpoint] ?? 0) + count;
  }
  return {
    total: a.total + b.total,
    retries: a.retries + b.retries,
    byEndpoint,
  };
}

export function mergeDbStats(a: DbCallStats, b: DbCallStats): DbCallStats {
  return {
    selects: a.selects + b.selects,
    inserts: a.inserts + b.inserts,
    updates: a.updates + b.updates,
    deletes: a.deletes + b.deletes,
    transactions: a.transactions + b.transactions,
  };
}

export function mergeIngestStepStats(
  a: IngestStepStats,
  b: IngestStepStats,
): IngestStepStats {
  return {
    banner: mergeBannerStats(a.banner, b.banner),
    db: mergeDbStats(a.db, b.db),
    sectionSync: b.sectionSync ?? a.sectionSync,
    scrape: b.scrape ?? a.scrape,
    descriptions: b.descriptions
      ? a.descriptions
        ? {
            crnsRequested:
              a.descriptions.crnsRequested + b.descriptions.crnsRequested,
            crnsFetched:
              a.descriptions.crnsFetched + b.descriptions.crnsFetched,
            contentChanged:
              a.descriptions.contentChanged + b.descriptions.contentChanged,
            timestampOnly:
              a.descriptions.timestampOnly + b.descriptions.timestampOnly,
            failures: a.descriptions.failures + b.descriptions.failures,
          }
        : b.descriptions
      : a.descriptions,
  };
}

/** Merge stats from multiple term scrapes in archive mode. */
export function mergeArchiveScrapeStats(
  existing: IngestStepStats | undefined,
  next: IngestStepStats,
): IngestStepStats {
  if (!existing) return next;
  const merged = mergeIngestStepStats(existing, next);
  if (existing.scrape && next.scrape) {
    merged.scrape = {
      subjects: existing.scrape.subjects + next.scrape.subjects,
      sections: existing.scrape.sections + next.scrape.sections,
      linkedBundles:
        existing.scrape.linkedBundles + next.scrape.linkedBundles,
      linkedCoursesSkipped:
        existing.scrape.linkedCoursesSkipped +
        next.scrape.linkedCoursesSkipped,
      politenessDelaysMs:
        existing.scrape.politenessDelaysMs + next.scrape.politenessDelaysMs,
    };
  }
  if (existing.sectionSync && next.sectionSync) {
    merged.sectionSync = {
      scraped: existing.sectionSync.scraped + next.sectionSync.scraped,
      unchanged: existing.sectionSync.unchanged + next.sectionSync.unchanged,
      inserted: existing.sectionSync.inserted + next.sectionSync.inserted,
      seatOnlyUpdates:
        existing.sectionSync.seatOnlyUpdates +
        next.sectionSync.seatOnlyUpdates,
      contentChanged:
        existing.sectionSync.contentChanged + next.sectionSync.contentChanged,
      removed: existing.sectionSync.removed + next.sectionSync.removed,
      catalogChanged:
        existing.sectionSync.catalogChanged || next.sectionSync.catalogChanged,
    };
  }
  return merged;
}

export function logIngestWorkflowSummary(
  workflow: string,
  stats: IngestStepStats,
  meta: Record<string, unknown> = {},
): void {
  console.log(
    `[${workflow}] run complete`,
    JSON.stringify({
      ...meta,
      bannerCalls: stats.banner.total,
      bannerRetries: stats.banner.retries,
      bannerByEndpoint: stats.banner.byEndpoint,
      dbCalls:
        stats.db.selects +
        stats.db.inserts +
        stats.db.updates +
        stats.db.deletes,
      db: stats.db,
      sectionSync: stats.sectionSync,
      scrape: stats.scrape,
      descriptions: stats.descriptions,
    }),
  );
}
