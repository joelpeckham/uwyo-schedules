import { describe, expect, it } from "vitest";
import {
  classifyBannerEndpoint,
  mergeArchiveScrapeStats,
  mergeIngestStepStats,
  recordBannerRequest,
  emptyIngestStepStats,
} from "./stats";

describe("ingest stats", () => {
  it("classifies Banner SSB endpoints from URL paths", () => {
    const base = "https://example.edu/StudentRegistrationSsb/ssb";
    expect(
      classifyBannerEndpoint(`${base}/searchResults/searchResults?x=1`, base),
    ).toBe("searchResults");
    expect(
      classifyBannerEndpoint(`${base}/searchResults/getCourseDescription?x=1`, base),
    ).toBe("getCourseDescription");
  });

  it("merges step stats across banner and db counters", () => {
    const a = emptyIngestStepStats();
    recordBannerRequest(a.banner, "https://x/ssb/classSearch/getTerms", "https://x/ssb");
    a.db.selects = 1;

    const b = emptyIngestStepStats();
    recordBannerRequest(
      b.banner,
      "https://x/ssb/searchResults/searchResults",
      "https://x/ssb",
    );
    b.db.updates = 3;
    b.sectionSync = {
      scraped: 100,
      unchanged: 90,
      inserted: 0,
      seatOnlyUpdates: 10,
      contentChanged: 0,
      removed: 0,
      catalogChanged: true,
    };

    const merged = mergeIngestStepStats(a, b);
    expect(merged.banner.total).toBe(2);
    expect(merged.db.selects).toBe(1);
    expect(merged.db.updates).toBe(3);
    expect(merged.sectionSync?.unchanged).toBe(90);
  });

  it("merges archive scrape totals across terms", () => {
    const first = emptyIngestStepStats();
    first.scrape = {
      subjects: 10,
      sections: 100,
      linkedBundles: 5,
      linkedCoursesSkipped: 2,
      politenessDelaysMs: 1000,
    };
    first.sectionSync = {
      scraped: 100,
      unchanged: 80,
      inserted: 0,
      seatOnlyUpdates: 20,
      contentChanged: 0,
      removed: 0,
      catalogChanged: true,
    };

    const second = emptyIngestStepStats();
    second.scrape = {
      subjects: 8,
      sections: 50,
      linkedBundles: 1,
      linkedCoursesSkipped: 0,
      politenessDelaysMs: 500,
    };
    second.sectionSync = {
      scraped: 50,
      unchanged: 50,
      inserted: 0,
      seatOnlyUpdates: 0,
      contentChanged: 0,
      removed: 0,
      catalogChanged: false,
    };

    const merged = mergeArchiveScrapeStats(first, second);
    expect(merged.scrape?.sections).toBe(150);
    expect(merged.sectionSync?.unchanged).toBe(130);
  });
});
