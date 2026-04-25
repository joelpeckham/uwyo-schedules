#!/usr/bin/env node
/**
 * Captures live Banner SSB responses into docs/banner-ssb-fixtures/
 * for golden reference. Requires network. Run: node scripts/capture-banner-fixtures.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "docs", "banner-ssb-fixtures");

const ORIGIN = "https://wyossb.uwyo.edu";
const PREFIX = `${ORIGIN}/StudentRegistrationSsb/ssb`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** @type {Map<string, string>} */
const jar = new Map();

function parseSynchronizerToken(html) {
  const m = html.match(
    /<meta\s+name=["']synchronizerToken["']\s+content=["']([^"']+)["']/i
  );
  return m ? m[1] : null;
}

function mergeSetCookie(setCookie) {
  if (!setCookie) return;
  const lines = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const line of lines) {
    const part = line.split(";")[0]?.trim();
    if (!part || !part.includes("=")) continue;
    const eq = part.indexOf("=");
    const name = part.slice(0, eq);
    const value = part.slice(eq + 1);
    jar.set(name, value);
  }
}

function cookieHeader() {
  if (jar.size === 0) return "";
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(label, url, init = {}) {
  const headers = {
    "User-Agent": UA,
    ...init.headers,
  };
  const ch = cookieHeader();
  if (ch) headers.Cookie = ch;

  const res = await fetch(url, { ...init, headers, redirect: "follow" });
  mergeSetCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"));
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") ?? "";
  const ext =
    ct.includes("json") || url.includes("getTerms") || url.includes("get_subject")
      ? "json"
      : ct.includes("html") || buf.slice(0, 100).toString().includes("<!DOCTYPE")
        ? "html"
        : "txt";
  const path = join(OUT, `${label}.${ext}`);
  writeFileSync(path, buf);
  const meta = {
    label,
    url: res.url,
    status: res.status,
    contentType: ct,
    bodyFile: `${label}.${ext}`,
    bytes: buf.length,
  };
  return { res, body: buf.toString("utf8"), meta, ext };
}

function xhrHeaders(token, referer) {
  return {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    "X-Synchronizer-Token": token,
    Referer: referer,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const metaLog = [];

  // 1 term selection
  let r = await request(
    "01-term-selection",
    `${PREFIX}/term/termSelection?mode=search`
  );
  metaLog.push(r.meta);
  let token = parseSynchronizerToken(r.body);
  if (!token) throw new Error("No synchronizerToken in term selection HTML");
  const termSelectionUrl = r.res.url;

  // Pick term: env wins, else first <option value="######"> from term page
  let termCode =
    process.env.BANNER_FIXTURE_TERM ||
    (() => {
      const opt = r.body.match(/<option[^>]+value=["'](\d{6})["']/i);
      return opt ? opt[1] : "202710";
    })();

  // 2 POST term search
  r = await request("02-term-search-response", `${PREFIX}/term/search?mode=search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "*/*",
      "X-Requested-With": "XMLHttpRequest",
      "X-Synchronizer-Token": token,
      Referer: termSelectionUrl,
    },
    body: new URLSearchParams({ term: termCode }).toString(),
  });
  metaLog.push({ ...r.meta, note: `POST body term=${termCode}` });

  // 3 class search shell
  r = await request("03-class-search", `${PREFIX}/classSearch/classSearch`);
  metaLog.push(r.meta);
  token = parseSynchronizerToken(r.body);
  if (!token) throw new Error("No synchronizerToken in class search HTML");
  const classSearchReferer = r.res.url;

  // 4 getTerms
  const termsUrl = `${PREFIX}/classSearch/getTerms?searchTerm=&offset=1&max=500`;
  r = await request("04-getTerms", termsUrl, {
    headers: xhrHeaders(token, classSearchReferer),
  });
  metaLog.push(r.meta);
  let terms;
  try {
    terms = JSON.parse(r.body);
  } catch {
    throw new Error("getTerms not JSON");
  }
  // Keep POSTed term for session unless caller set BANNER_FIXTURE_TERM (already aligned)
  if (!process.env.BANNER_FIXTURE_TERM && Array.isArray(terms) && terms[0]?.code) {
    termCode = terms[0].code;
  }

  // 5 get_subject page 1
  const subjUrl = `${PREFIX}/classSearch/get_subject?searchTerm=&term=${encodeURIComponent(termCode)}&offset=1&max=100`;
  r = await request("05-get-subject-page1", subjUrl, {
    headers: xhrHeaders(token, classSearchReferer),
  });
  metaLog.push(r.meta);
  let subjects;
  try {
    subjects = JSON.parse(r.body);
  } catch {
    subjects = [];
  }
  const subjectCode =
    process.env.BANNER_FIXTURE_SUBJECT ||
    (subjects.find((s) => s.code)?.code ?? "MATH");

  // 6 reset + searchResults
  r = await request("06-resetDataForm", `${PREFIX}/classSearch/resetDataForm`, {
    method: "POST",
    headers: {
      ...xhrHeaders(token, classSearchReferer),
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: "",
  });
  metaLog.push({ ...r.meta, note: "POST empty body" });

  const srParams = new URLSearchParams({
    txt_subject: subjectCode,
    txt_term: termCode,
    startDatepicker: "",
    endDatepicker: "",
    pageOffset: "0",
    pageMaxSize: "500",
    sortColumn: "subjectDescription",
    sortDirection: "asc",
  });
  const srUrl = `${PREFIX}/searchResults/searchResults?${srParams}`;
  r = await request(
    `07-searchResults-${subjectCode}-page0`,
    srUrl,
    { headers: xhrHeaders(token, classSearchReferer) }
  );
  metaLog.push(r.meta);

  let linkedCrn = process.env.BANNER_FIXTURE_LINKED_CRN || "";
  let searchData;
  try {
    searchData = JSON.parse(r.body);
  } catch {
    searchData = null;
  }
  if (searchData?.data && Array.isArray(searchData.data)) {
    const linked = searchData.data.find((row) => row.isSectionLinked);
    if (linked?.courseReferenceNumber) {
      linkedCrn = linkedCrn || String(linked.courseReferenceNumber);
    }
    if (!linkedCrn && searchData.data[0]?.courseReferenceNumber) {
      linkedCrn = String(searchData.data[0].courseReferenceNumber);
    }
  }

  if (linkedCrn) {
    const lk = `${PREFIX}/searchResults/fetchLinkedSections?term=${encodeURIComponent(termCode)}&courseReferenceNumber=${encodeURIComponent(linkedCrn)}`;
    r = await request(
      `08-fetchLinkedSections-${linkedCrn}`,
      lk,
      { headers: xhrHeaders(token, classSearchReferer) }
    );
    metaLog.push(r.meta);
  }

  writeFileSync(
    join(OUT, "capture-meta.json"),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        origin: ORIGIN,
        termCodeUsed: termCode,
        subjectCodeUsed: subjectCode,
        linkedCrn: linkedCrn || null,
        sequence: metaLog,
      },
      null,
      2
    )
  );

  // README from template + live values
  const readme = `# Banner SSB fixtures (University of Wyoming)

These files were produced by \`node scripts/capture-banner-fixtures.mjs\` against live **${ORIGIN}**.

## Request order (cookie session required)

1. **01-term-selection.html** — \`GET /term/termSelection?mode=search\` — parse \`synchronizerToken\`.
2. **02-term-search-response** — \`POST /term/search?mode=search\` with \`term=<code>\` — establishes term (see \`capture-meta.json\` for code used).
3. **03-class-search.html** — \`GET /classSearch/classSearch\` — new token; **Referer** for subsequent XHRs = this response URL.
4. **04-getTerms.json** — \`GET /classSearch/getTerms?searchTerm=&offset=1&max=500\`
5. **05-get-subject-page1.json** — \`GET /classSearch/get_subject?searchTerm=&term=<code>&offset=1&max=100\`
6. **06-resetDataForm.html** — \`POST /classSearch/resetDataForm\` (empty body); small HTML/empty response body.
7. **07-searchResults-&lt;SUBJECT&gt;-page0.json** — \`GET /searchResults/searchResults\` with subject/term/pagination params (see protocol doc).
8. **08-fetchLinkedSections-&lt;CRN&gt;.json** — \`GET /searchResults/fetchLinkedSections\` when a linked anchor CRN is found or \`BANNER_FIXTURE_LINKED_CRN\` is set.

## Repro / overrides

Environment variables (optional):

- \`BANNER_FIXTURE_TERM\` — Banner term code (6 digits)
- \`BANNER_FIXTURE_SUBJECT\` — subject code (e.g. MATH)
- \`BANNER_FIXTURE_LINKED_CRN\` — anchor CRN for linked sections

See **capture-meta.json** for the exact values from the last capture.

## Notes

- **Do not commit** live session cookies; this folder stores response bodies only.
- Shapes should match [banner-ssb-class-search-scraping.md](../banner-ssb-class-search-scraping.md); these files are the **live** ground truth.
`;

  writeFileSync(join(OUT, "README.md"), readme);

  console.log("Wrote fixtures to", OUT);
  console.log("term=", termCode, "subject=", subjectCode, "linkedCrn=", linkedCrn || "(none)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
