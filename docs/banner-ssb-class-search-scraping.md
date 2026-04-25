# Banner Student Self-Service: class search scraping protocol

This document describes the **HTTP-level protocol** for pulling class schedule data from **Ellucian Banner** “Student Registration” **Student Self-Service (SSB)**—the same flows a student uses in the public class search UI. It is **implementation-agnostic**: any HTTP client with cookies, redirects, and header control can reproduce it.

**Scope:** from a cold session through listing terms, subjects, and section rows, plus an optional second pass for **linked** sections. It does **not** cover app-specific storage (object stores, gzip manifests, or custom normalized catalog schemas).

**Disclaimer:** Use only in line with the institution’s terms of use, acceptable use, and rate expectations. This describes behavior observed on public SSB endpoints for integration and testing.

---

## 1. Context

### What you are talking to

- **Product:** Ellucian Banner **Student Registration** SSB (browser “class search”).
- **Transport:** HTTPS.
- **Institution-specific:** the **origin** host (example: `https://wyossb.uwyo.edu` for University of Wyoming).
- **Portable path prefix** (common across Banner SSB deployments):

  `{ORIGIN}/StudentRegistrationSsb/ssb/...`

  Here `{ORIGIN}` is the scheme + host with no trailing slash. All endpoints below are relative to `{ORIGIN}/StudentRegistrationSsb/ssb`.

---

## 2. Session model

### Cookies and redirects

1. Start with **no** session cookies.
2. Use **redirect following** when the server responds with redirects (e.g. HTTP 302 → follow to final URL). The initial `GET .../term/termSelection?mode=search` response may instead be **HTTP 200** with **no redirect chain**, depending on deployment. Banner sets session cookies on early responses.
3. On every request, send **all** cookies the server has issued for the request URL’s host and path scope (standard cookie jar behavior).
4. On every response, **store** `Set-Cookie` headers into that jar.

Without a correct cookie jar, later XHRs often fail or return HTML error pages instead of JSON.

`GET .../searchResults/searchResults` without a **term-bound session** (no prior successful term selection in the cookie jar) can still return **HTTP 200** with `success: true`, **`totalCount: 0`**, and **`data: null`**. That is not a successful empty catalog—use a cookie jar, select the term, and typically **`GET .../classSearch/classSearch`** before trusting section counts or pagination.

### Client fingerprint

Send a **realistic browser `User-Agent`**. Banner may behave differently or block obvious bot defaults. Example (Chrome on macOS style):

```http
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

### Referer and “XHR” behavior

Many JSON endpoints expect the request to look like an **in-page XMLHttpRequest** from the class search UI. Institution and Banner version vary: some hosts accept omitting **`Referer`** or **`X-Synchronizer-Token`** on read-only JSON GETs, but you should still send both for **portability** and to match browser behavior.

- Set **`Referer`** to the **final URL** of the most recent successful **`GET .../classSearch/classSearch`** response (after redirects). That URL typically includes query parameters Banner added.
- Keep **`Referer` in sync** whenever you reload the class search page (see synchronizer section).

---

## 3. Synchronizer token (“token”)

This is **not** OAuth, API keys, or JWT. Banner embeds a **CSRF-style synchronizer token** in HTML.

### How to obtain it

After each relevant **HTML** response (`termSelection`, `classSearch`), parse the **body** text and extract:

```html
<meta name="synchronizerToken" content="TOKEN_VALUE_HERE">
```

Case-insensitive match on the tag name; the `content` attribute holds the token. If the tag is missing, subsequent POST/XHR calls will usually fail.

### How to send it

Include on requests that mutate state or load JSON from SSB (recommended on most deployments; some institutions are lenient on read-only JSON GETs):

```http
X-Synchronizer-Token: TOKEN_VALUE_HERE
```

For POSTs that mirror the browser (e.g. term selection), also send:

```http
X-Requested-With: XMLHttpRequest
```

### When to refresh it

- Immediately after **`POST .../term/search`** (term selection): reload class search HTML and re-parse.
- After any **`GET .../classSearch/classSearch`**: parse again; update **`Referer`** to that response’s final URL.
- On **401** or **403** from an XHR: **once** reload `classSearch` HTML, re-parse the token, update `Referer`, then retry the failed request.

---

## 4. Recommended request sequence

High-level order:

1. Warm session + first token (`termSelection`).
2. For each term you care about: **POST** term search, then **GET** class search HTML (token + Referer for the rest of the scrape).
3. **GET** terms JSON (optional if you already know term codes).
4. For each term: **GET** subjects in pages.
5. For each subject: **POST** reset form, then **GET** `searchResults` in pages until done.
6. Optionally: **GET** `fetchLinkedSections` and/or **POST** `getLinkedSections` for sections that participate in linked registration (see section 7).

### Sequence diagram

```mermaid
sequenceDiagram
  participant Client
  participant Banner as Banner_SSB

  Client->>Banner: GET term/termSelection?mode=search
  Banner-->>Client: HTML plus Set-Cookie
  Note over Client: Parse synchronizerToken from HTML

  Client->>Banner: POST term/search?mode=search (term=CODE)
  Banner-->>Client: JSON fwdURL and/or HTML or redirect chain

  Client->>Banner: GET classSearch/classSearch
  Banner-->>Client: HTML plus Set-Cookie
  Note over Client: Parse token; set Referer to final URL

  Client->>Banner: GET classSearch/getTerms
  Banner-->>Client: JSON terms array

  loop Each term to scrape
    Client->>Banner: POST term/search (if not current)
    Client->>Banner: GET classSearch/classSearch
    loop Subject pages
      Client->>Banner: GET classSearch/get_subject
      Banner-->>Client: JSON subject rows
    end
    loop Each subject code
      Client->>Banner: POST classSearch/resetDataForm
      loop Search result pages
        Client->>Banner: GET searchResults/searchResults
        Banner-->>Client: JSON wrapper plus data rows
      end
    end
  end

  opt Linked sections pass
    Client->>Banner: GET searchResults/fetchLinkedSections
    Banner-->>Client: JSON linkedData
    Client->>Banner: POST searchResults/getLinkedSections
    Banner-->>Client: HTML tables
  end
```

---

## 5. Endpoint reference

All paths are under `{ORIGIN}/StudentRegistrationSsb/ssb`.

| Step | Method | Path | Query or body | Recommended headers (beyond cookies; vary by institution) | Response |
|------|--------|------|----------------|-------------------------------------------------------------|----------|
| Warm / first token | GET | `/term/termSelection` | `mode=search` | `User-Agent` | HTML; parse `synchronizerToken`; note final URL for `Referer` on term POST |
| Select term | POST | `/term/search` | `mode=search` (query); body `application/x-www-form-urlencoded`: `term=<termCode>` | `X-Synchronizer-Token`, `X-Requested-With: XMLHttpRequest`, `Content-Type: application/x-www-form-urlencoded; charset=UTF-8`, `Referer` from prior step, `Accept: */*` | Often **JSON** with `fwdURL` (path to load next, e.g. `/StudentRegistrationSsb/ssb/classSearch/classSearch`); **and/or** HTML / redirects on some deployments. Establishes term in session. Clients typically **`GET .../classSearch/classSearch`** next (equivalent to following `fwdURL` when present). |
| Class search shell | GET | `/classSearch/classSearch` | (none required) | `User-Agent` | HTML; **parse new token**; set **`Referer`** to this response’s final URL |
| List terms | GET | `/classSearch/getTerms` | `searchTerm=` (empty), `offset=1`, `max=<N>` (e.g. 500) | Browser-like XHR profile: `X-Synchronizer-Token`, `X-Requested-With: XMLHttpRequest`, `Accept: application/json, text/javascript, */*; q=0.01`, **`Referer`** = class search URL | JSON array of term objects |
| List subjects (paged) | GET | `/classSearch/get_subject` | `searchTerm=`, `term=<termCode>`, `offset=<page>` (1-based page index in typical clients), `max=<pageSize>` (e.g. 100) | Same as `getTerms` | JSON array of subject objects; empty array = no more pages |
| Reset search form | POST | `/classSearch/resetDataForm` | (no body) | Same as `getTerms` | Non-JSON; success indicated by HTTP 2xx |
| Section search (paged) | GET | `/searchResults/searchResults` | See query string below | Same as `getTerms` | JSON object with `success`, `data`, optional `totalCount` (see §2 if `data` is `null` with `success: true`) |
| Linked sections (JSON) | GET | `/searchResults/fetchLinkedSections` | Query: `term=<termCode>`, `courseReferenceNumber=<crn>` | Same as `getTerms` | JSON: **`linkedData`** = array of bundles; each bundle is an array of **full section objects** (same shape as `searchResults` rows). See §6. |
| Linked section **options** (HTML) | POST | `/searchResults/getLinkedSections` | Body `application/x-www-form-urlencoded`: `term=<termCode>&courseReferenceNumber=<crn>` | XHR-style POST: `Content-Type: application/x-www-form-urlencoded; charset=UTF-8`, `X-Requested-With: XMLHttpRequest`, `X-Synchronizer-Token`, **`Referer`** = class search URL, `Accept: text/html, */*; q=0.01` (or similar); session cookies | **HTML** tables: same **valid registration bundles** as **`GET .../fetchLinkedSections`** `linkedData`, in UI form. Clients must **parse HTML** (markup varies by institution and Banner skin). |

### `searchResults` query string (exact parameter names)

Build a query string (order is not guaranteed to matter, but names must match):

| Parameter | Typical value |
|-----------|----------------|
| `txt_subject` | Subject code, e.g. `MATH` |
| `txt_term` | Banner term code, e.g. `202710` |
| `startDatepicker` | Empty string |
| `endDatepicker` | Empty string |
| `pageOffset` | Integer offset into results (see pagination) |
| `pageMaxSize` | Page size, e.g. `500` |
| `sortColumn` | e.g. `subjectDescription` |
| `sortDirection` | e.g. `asc` |

Example path-only fragment (encode for HTTP):

`/searchResults/searchResults?txt_subject=MATH&txt_term=202710&startDatepicker=&endDatepicker=&pageOffset=0&pageMaxSize=500&sortColumn=subjectDescription&sortDirection=asc`

---

## 6. Example responses (synthetic)

Field names are **Banner’s JSON** (mostly **camelCase**). Real rows contain many more keys than shown here.

### `getTerms`

```json
[
  { "code": "202710", "description": "Fall 2027" },
  { "code": "202720", "description": "Spring 2028" }
]
```

### `get_subject`

```json
[
  { "code": "MATH", "description": "Mathematics" },
  { "code": "CS", "description": "Computer Science" }
]
```

### `searchResults` (one page)

Wrapper shape:

```json
{
  "success": true,
  "totalCount": 42,
  "data": [
    {
      "term": "202710",
      "termDesc": "Fall 2027",
      "courseReferenceNumber": "12345",
      "subject": "MATH",
      "subjectDescription": "Mathematics",
      "courseNumber": "2200",
      "sequenceNumber": "001",
      "courseTitle": "Calculus I",
      "subjectCourse": "MATH 2200",
      "creditHours": 4,
      "enrollment": 24,
      "maximumEnrollment": 30,
      "seatsAvailable": 6,
      "openSection": true,
      "linkIdentifier": "A1",
      "isSectionLinked": true,
      "crossList": null,
      "faculty": [
        {
          "bannerId": "700123456",
          "displayName": "Doe, Jane",
          "emailAddress": "jdoe@example.edu",
          "primaryIndicator": true
        }
      ],
      "meetingsFaculty": [
        {
          "meetingTime": {
            "beginTime": "09:00 am",
            "endTime": "09:50 am",
            "monday": true,
            "wednesday": true,
            "friday": true,
            "building": "AG",
            "buildingDescription": "Agriculture Building",
            "room": "101",
            "campusDescription": "Main Campus",
            "startDate": "Aug 25, 2027",
            "endDate": "Dec 05, 2027",
            "meetingScheduleType": "Lecture",
            "meetingTypeDescription": "Lecture",
            "hoursWeek": 3.0
          }
        }
      ],
      "sectionAttributes": [
        { "code": "HNRS", "description": "Honors section" }
      ]
    }
  ]
}
```

If `success` is not JSON boolean `true`, treat the page as an error for that subject/term.

### Pagination rules for `searchResults`

Let `pageMaxSize` be your requested page size (e.g. 500).

1. Start with `pageOffset = 0` (or the offset your first successful call used).
2. Read `data` as an array of section rows. If `data` is **`null`** or not an array, treat as a missing session or error (see §2)—do **not** treat it as an empty last page for pagination.
3. Let `chunkLen` = `data.length`. Advance: `pageOffset += chunkLen` (increment by **actual chunk length**, not always `pageMaxSize`).
4. Stop when:
   - `totalCount` is present and numeric and `pageOffset >= totalCount`, or
   - `chunkLen === 0`, or
   - `chunkLen < pageMaxSize` and `totalCount` is missing or zero (last page heuristic).
5. Deduplicate by `courseReferenceNumber` if the API ever overlaps rows across pages.

Apply a **hard cap** on the number of pages per subject (e.g. 250) so a bug or API change cannot loop forever.

### `fetchLinkedSections`

Response shape: `{ "linkedData": <array> }`. **`linkedData`** is the machine-readable equivalent of the **linked registration options** the UI shows (including **`POST .../getLinkedSections`** HTML tables): each **outer** element is **one valid registration bundle** for the anchor section you queried; each **inner** array lists the **sections that must be registered together** in that bundle.

- **Inner arrays** usually contain **full section objects**—the same rich JSON shape as rows in **`searchResults`** (`courseReferenceNumber`, `subject`, `scheduleTypeDescription`, `meetingsFaculty`, `faculty`, `linkIdentifier`, `isSectionLinked`, enrollment fields, `sectionAttributes`, Java `class` noise fields, etc.), not only `{ "courseReferenceNumber": "..." }`.
- **Outer array length** = number of distinct bundles (e.g. every compatible discussion + lab pair for a large lecture). For busy courses this can be **dozens of bundles** and a **large JSON payload** (hundreds of KB).

**Live example (trimmed):** `GET .../fetchLinkedSections?term=202710&courseReferenceNumber=10224` on University of Wyoming SSB returned **`linkedData` with length 49**; each element was a **pair** of sections (discussion + lab) for **PHYS 1110**. One bundle looked conceptually like this (most keys omitted):

```json
{
  "linkedData": [
    [
      {
        "term": "202710",
        "termDesc": "Fall 2026",
        "courseReferenceNumber": "10238",
        "subject": "PHYS",
        "subjectDescription": "Physics",
        "courseNumber": "1110",
        "sequenceNumber": "25",
        "scheduleTypeDescription": "Discussion",
        "courseTitle": "Discussion",
        "linkIdentifier": "D1",
        "isSectionLinked": true,
        "subjectCourse": "PHYS1110",
        "faculty": [{ "displayName": "Barrans, Richard", "primaryIndicator": true }],
        "meetingsFaculty": [{ "meetingTime": { "wednesday": true, "beginTime": "1510", "endTime": "1600", "building": "EN", "room": "2100" } }],
        "status": { "sectionOpen": true, "timeConflict": false }
      },
      {
        "term": "202710",
        "courseReferenceNumber": "10230",
        "subject": "PHYS",
        "courseNumber": "1110",
        "sequenceNumber": "14",
        "scheduleTypeDescription": "Lab",
        "courseTitle": "Laboratory",
        "linkIdentifier": "L1",
        "isSectionLinked": true,
        "subjectCourse": "PHYS1110",
        "meetingsFaculty": [{ "meetingTime": { "wednesday": true, "beginTime": "1100", "endTime": "1250", "building": "STEM", "room": "175" } }]
      }
    ]
  ]
}
```

The next outer element might be another discussion CRN paired with a **different** lab CRN, and so on—same information the HTML “pick a valid combination” grid encodes.

**Other shapes you may still see:**

- **Several bundles:** `linkedData` is always an array of bundles; length may be `1` or large.
- **Single-section bundle:** one inner array with a **single** object (e.g. only a lab row) if Banner models it that way for some courses.
- **Sparse placeholder rows:** older docs sometimes show only `courseReferenceNumber` per object; treat that as a **degenerate** case—real SSB payloads are typically full rows.

Invalid JSON or missing `linkedData` should be treated as “no linked data” for that CRN.

### `getLinkedSections` (HTML tables)

**POST** `{ORIGIN}/StudentRegistrationSsb/ssb/searchResults/getLinkedSections` with the same **term** and **course reference number** as `fetchLinkedSections`, but as **form-urlencoded body** fields (not query parameters):

```http
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

term=202710&courseReferenceNumber=10224
```

The response body is **`text/html`**: **`<table>` (and related) markup** for the same **valid combination matrix** described above. **`GET .../fetchLinkedSections`** returns **the same logical combinations as structured JSON**; prefer it when you want to avoid HTML parsing. Use **`POST .../getLinkedSections`** when you must mirror the browser DOM, debug against the UI, or compare markup to parsed JSON.

---

## 7. Optional linked-sections pass

`searchResults` rows may include `isSectionLinked` and `linkIdentifier`. To discover linked registration data (beyond what appeared in the first subject’s search), clients often run a **second pass** for each relevant `(term, courseReferenceNumber)` (e.g. one representative CRN per `(term, linkIdentifier, subject+course)` family):

- **`GET .../searchResults/fetchLinkedSections`** — parse JSON **`linkedData`**: each outer entry is one valid bundle; inner arrays hold **full section rows** (same field set as `searchResults`). See §6.
- **`POST .../searchResults/getLinkedSections`** — same combinations as **`linkedData`**, rendered as **HTML tables**; parse only if you need the UI representation. See §6 (`getLinkedSections`).

**Note:** `linkIdentifier` values can be **reused across unrelated courses** (short codes like `A1`). Grouping only by `linkIdentifier` can merge unrelated sections. Safer strategies bucket by **term + link identifier + canonical subject/course** (or equivalent) before choosing representative CRNs for API calls.

---

## 8. Field glossary (`searchResults` rows)

Consumers map Banner JSON to their own schema. Common top-level keys used for schedules include:

| Banner JSON (examples) | Meaning |
|------------------------|---------|
| `term`, `termDesc` | Term code and description |
| `courseReferenceNumber` | CRN (unique per term) |
| `subject`, `subjectDescription`, `courseNumber`, `sequenceNumber` | Course identity |
| `courseTitle`, `subjectCourse` | Titles / display strings |
| `creditHours`, `partOfTerm` | Credit / part of term |
| `enrollment`, `maximumEnrollment`, `seatsAvailable`, `waitCapacity`, `waitCount`, `waitAvailable` | Capacity |
| `openSection` | Whether section is open |
| `linkIdentifier`, `isSectionLinked` | Linked registration |
| `crossList`, `crossListCapacity`, `crossListCount`, `crossListAvailable` | Cross-list groups |
| `faculty` | Instructor list (`bannerId`, `displayName`, `emailAddress`, `primaryIndicator`) |
| `meetingsFaculty` | Meetings; nested `meetingTime` with days, times, building, room, dates |
| `sectionAttributes` | Tags (`code`, `description`) |

Exact availability varies by institution and Banner version.

---

## 9. Operational guidance

| Topic | Recommendation |
|--------|------------------|
| Politeness | Insert a **delay** between subject (or term) iterations; full-catalog scrapes issue many requests. |
| Timeouts | Use generous read timeouts (on the order of **minutes** for slow registrar responses). |
| Retries | On **5xx**, retry with **exponential backoff** a small bounded number of times (e.g. 4 attempts, ~1.5s base backoff). |
| Token / session hygiene | Periodically **`GET classSearch/classSearch`** again during long runs to refresh the synchronizer token and session (e.g. every N subjects). |
| Page sizes | Typical values: subjects **100** per page; search results **500** per page (tune if the server caps differently). |
| User-Agent | Keep a modern desktop browser string. |

---

## 10. Constants reference (example defaults)

These are **not** Banner requirements; they are sensible defaults used in one production scraper aligned with this repository:

| Constant | Example value |
|----------|----------------|
| Subject page size | 100 |
| Search results page size | 500 |
| Max search result pages per subject | 250 |
| Retry attempts | 4 |
| Backoff multiplier (seconds, scaled per attempt) | ~1.5 |

Adjust per institution after observing behavior and any documented limits.
