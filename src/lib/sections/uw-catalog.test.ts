import { describe, expect, it } from "vitest";
import { uwCatalogCourseSearchUrl } from "./uw-catalog";

describe("uwCatalogCourseSearchUrl", () => {
  it("builds a keyword-filtered catalog search URL", () => {
    const url = uwCatalogCourseSearchUrl("PHYS", "1110");
    expect(url).toContain("https://acalogcatalog.uwyo.edu/search_advanced.php?");
    expect(url).toContain("cur_cat_oid=19");
    expect(url).toContain("filter%5Bkeyword%5D=PHYS1110");
    expect(url).toContain("filter%5Bexact_match%5D=1");
  });

  it("returns null when subject or course number is missing", () => {
    expect(uwCatalogCourseSearchUrl(null, "1110")).toBeNull();
    expect(uwCatalogCourseSearchUrl("PHYS", "")).toBeNull();
    expect(uwCatalogCourseSearchUrl("  ", "1110")).toBeNull();
  });
});
