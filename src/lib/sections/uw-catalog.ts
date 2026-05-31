/** UW acalog catalog advanced search (course catalog, not Banner registration). */
const UW_CATALOG_ORIGIN = "https://acalogcatalog.uwyo.edu";

/** Current catalog edition; bump when UW publishes a new catalog year. */
const UW_CATALOG_OID = "19";

const UW_CATALOG_SEARCH_PATH = "/search_advanced.php";

/**
 * Build an acalog advanced-search URL filtered to a course keyword
 * (e.g. PHYS + 1110 → PHYS1110).
 */
export function uwCatalogCourseSearchUrl(
  subject: string | null | undefined,
  courseNumber: string | null | undefined,
): string | null {
  const sub = subject?.trim();
  const num = courseNumber?.trim();
  if (!sub || !num) return null;

  const keyword = `${sub}${num}`;
  const params = new URLSearchParams({
    cur_cat_oid: UW_CATALOG_OID,
    ecpage: "1",
    cpage: "1",
    ppage: "1",
    pcpage: "1",
    spage: "1",
    tpage: "1",
    search_database: "Search",
    "filter[keyword]": keyword,
    "filter[chosen_locations]": "",
    "filter[exact_match]": "1",
    "filter[3]": "1",
    "filter[31]": "1",
  });

  return `${UW_CATALOG_ORIGIN}${UW_CATALOG_SEARCH_PATH}?${params.toString()}`;
}
