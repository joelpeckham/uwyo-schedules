# Banner SSB fixtures (University of Wyoming)

These files were produced by `node scripts/capture-banner-fixtures.mjs` against live **https://wyossb.uwyo.edu**.

## Request order (cookie session required)

1. **01-term-selection.html** — `GET /term/termSelection?mode=search` — parse `synchronizerToken`.
2. **02-term-search-response** — `POST /term/search?mode=search` with `term=<code>` — establishes term (see `capture-meta.json` for code used).
3. **03-class-search.html** — `GET /classSearch/classSearch` — new token; **Referer** for subsequent XHRs = this response URL.
4. **04-getTerms.json** — `GET /classSearch/getTerms?searchTerm=&offset=1&max=500`
5. **05-get-subject-page1.json** — `GET /classSearch/get_subject?searchTerm=&term=<code>&offset=1&max=100`
6. **06-resetDataForm.html** — `POST /classSearch/resetDataForm` (empty body); small HTML/empty response body.
7. **07-searchResults-PHYS-page0.json** (subject varies) — `GET /searchResults/searchResults` with subject/term/pagination params (see protocol doc).
8. **08-fetchLinkedSections-10224.json** (CRN varies) — `GET /searchResults/fetchLinkedSections` when a linked anchor CRN is found or `BANNER_FIXTURE_LINKED_CRN` is set.

## Repro / overrides

Environment variables (optional):

- `BANNER_FIXTURE_TERM` — Banner term code (6 digits)
- `BANNER_FIXTURE_SUBJECT` — subject code (e.g. MATH)
- `BANNER_FIXTURE_LINKED_CRN` — anchor CRN for linked sections

See **capture-meta.json** for the exact values from the last capture.

## Notes

- **Do not commit** live session cookies; this folder stores response bodies only.
- Shapes should match [banner-ssb-class-search-scraping.md](../banner-ssb-class-search-scraping.md); these files are the **live** ground truth.
