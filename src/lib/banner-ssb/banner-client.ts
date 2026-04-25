import {
  BANNER_SSB_PREFIX,
  DEFAULT_USER_AGENT,
  FETCH_TIMEOUT_MS,
  MAX_SEARCH_RESULT_PAGES_PER_SUBJECT,
  SEARCH_RESULTS_PAGE_SIZE,
  SUBJECT_PAGE_SIZE,
} from "./constants";
import type {
  BannerSubject,
  BannerTerm,
  FetchLinkedSectionsResponse,
  SearchResultsResponse,
  SearchResultsRow,
} from "./types";

function parseSynchronizerToken(html: string): string | null {
  const m = html.match(
    /<meta\s+name=["']synchronizerToken["']\s+content=["']([^"']+)["']/i
  );
  return m ? m[1] : null;
}

function mergeSetCookie(
  jar: Map<string, string>,
  setCookie: string | string[] | null
) {
  if (!setCookie) return;
  const lines = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const line of lines) {
    const part = line.split(";")[0]?.trim();
    if (!part?.includes("=")) continue;
    const eq = part.indexOf("=");
    jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
}

function cookieHeader(jar: Map<string, string>): string {
  if (jar.size === 0) return "";
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetries(
  url: string,
  init: RequestInit,
  attempts = 4
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchWithTimeout(url, init);
      if (res.status >= 500) {
        await new Promise((r) =>
          setTimeout(r, Math.round(1500 * Math.pow(1.5, i)))
        );
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      await new Promise((r) =>
        setTimeout(r, Math.round(1500 * Math.pow(1.5, i)))
      );
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr ?? "fetch failed"));
}

export class BannerSsbClient {
  private readonly jar = new Map<string, string>();
  private synchronizerToken: string | null = null;
  private classSearchReferer: string | null = null;
  private termSelectionUrl: string | null = null;

  constructor(
    private readonly prefix = BANNER_SSB_PREFIX,
    private readonly userAgent = DEFAULT_USER_AGENT
  ) {}

  private async doFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("User-Agent", this.userAgent);
    const ch = cookieHeader(this.jar);
    if (ch) headers.set("Cookie", ch);
    const res = await fetchWithRetries(url, { ...init, headers });
    const raw = res.headers.get("set-cookie");
    const multi = (res.headers as unknown as { getSetCookie?: () => string[] })
      .getSetCookie?.();
    mergeSetCookie(this.jar, multi ?? raw);
    return res;
  }

  xhrHeaders(): HeadersInit {
    if (!this.synchronizerToken || !this.classSearchReferer) {
      throw new Error("Missing synchronizer token or class search Referer");
    }
    return {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "X-Synchronizer-Token": this.synchronizerToken,
      Referer: this.classSearchReferer,
    };
  }

  async getTermSelectionHtml(): Promise<{ html: string; url: string }> {
    const url = `${this.prefix}/term/termSelection?mode=search`;
    const res = await this.doFetch(url);
    const html = await res.text();
    this.termSelectionUrl = res.url;
    const token = parseSynchronizerToken(html);
    if (!token) throw new Error("No synchronizerToken in term selection HTML");
    this.synchronizerToken = token;
    return { html, url: res.url };
  }

  async postTermSearch(termCode: string): Promise<string> {
    if (!this.synchronizerToken || !this.termSelectionUrl) {
      throw new Error("Call getTermSelectionHtml before postTermSearch");
    }
    const url = `${this.prefix}/term/search?mode=search`;
    const body = new URLSearchParams({ term: termCode }).toString();
    const res = await this.doFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
        "X-Synchronizer-Token": this.synchronizerToken,
        Referer: this.termSelectionUrl,
      },
      body,
    });
    return res.text();
  }

  async getClassSearchHtml(): Promise<{ html: string; url: string }> {
    const url = `${this.prefix}/classSearch/classSearch`;
    const res = await this.doFetch(url);
    const html = await res.text();
    this.classSearchReferer = res.url;
    const token = parseSynchronizerToken(html);
    if (!token) throw new Error("No synchronizerToken in class search HTML");
    this.synchronizerToken = token;
    return { html, url: res.url };
  }

  /** Reload class search HTML to refresh token (e.g. after 401/403). */
  async refreshClassSearch(): Promise<void> {
    await this.getClassSearchHtml();
  }

  async getTerms(max = 500): Promise<BannerTerm[]> {
    const url = `${this.prefix}/classSearch/getTerms?searchTerm=&offset=1&max=${max}`;
    const res = await this.doFetch(url, { headers: this.xhrHeaders() });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`getTerms failed: ${res.status} ${text.slice(0, 200)}`);
    }
    return JSON.parse(text) as BannerTerm[];
  }

  async getSubjectPage(
    termCode: string,
    offset: number
  ): Promise<BannerSubject[]> {
    const params = new URLSearchParams({
      searchTerm: "",
      term: termCode,
      offset: String(offset),
      max: String(SUBJECT_PAGE_SIZE),
    });
    const url = `${this.prefix}/classSearch/get_subject?${params}`;
    const res = await this.doFetch(url, { headers: this.xhrHeaders() });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `get_subject failed: ${res.status} ${text.slice(0, 200)}`
      );
    }
    return JSON.parse(text) as BannerSubject[];
  }

  async resetDataForm(): Promise<void> {
    const url = `${this.prefix}/classSearch/resetDataForm`;
    const res = await this.doFetch(url, {
      method: "POST",
      headers: {
        ...this.xhrHeaders(),
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: "",
    });
    if (!res.ok) {
      throw new Error(`resetDataForm failed: ${res.status}`);
    }
  }

  async getSearchResultsPage(
    termCode: string,
    subjectCode: string,
    pageOffset: number
  ): Promise<SearchResultsResponse> {
    const params = new URLSearchParams({
      txt_subject: subjectCode,
      txt_term: termCode,
      startDatepicker: "",
      endDatepicker: "",
      pageOffset: String(pageOffset),
      pageMaxSize: String(SEARCH_RESULTS_PAGE_SIZE),
      sortColumn: "subjectDescription",
      sortDirection: "asc",
    });
    const url = `${this.prefix}/searchResults/searchResults?${params}`;
    const res = await this.doFetch(url, { headers: this.xhrHeaders() });
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error(`searchResults auth: ${res.status}`);
    }
    if (!res.ok) {
      throw new Error(
        `searchResults failed: ${res.status} ${text.slice(0, 200)}`
      );
    }
    return JSON.parse(text) as SearchResultsResponse;
  }

  async fetchAllSearchResultsForSubject(
    termCode: string,
    subjectCode: string
  ): Promise<{ rows: SearchResultsRow[]; pages: SearchResultsResponse[] }> {
    const rows: SearchResultsRow[] = [];
    const pages: SearchResultsResponse[] = [];
    const seen = new Set<string>();
    let pageOffset = 0;
    for (let p = 0; p < MAX_SEARCH_RESULT_PAGES_PER_SUBJECT; p++) {
      const page = await this.getSearchResultsPage(
        termCode,
        subjectCode,
        pageOffset
      );
      pages.push(page);
      if (!page.success) {
        throw new Error(
          `searchResults success=false for ${subjectCode} offset=${pageOffset}`
        );
      }
      const data = page.data;
      if (data === null || !Array.isArray(data)) {
        throw new Error(
          `searchResults invalid data for ${subjectCode} offset=${pageOffset}`
        );
      }
      const chunkLen = data.length;
      for (const row of data) {
        const crn = row.courseReferenceNumber;
        if (typeof crn === "string" && !seen.has(crn)) {
          seen.add(crn);
          rows.push(row);
        }
      }
      pageOffset += chunkLen;
      const total = page.totalCount;
      if (typeof total === "number" && pageOffset >= total) break;
      if (chunkLen === 0) break;
      if (
        chunkLen < SEARCH_RESULTS_PAGE_SIZE &&
        (total === undefined || total === 0)
      ) {
        break;
      }
    }
    return { rows, pages };
  }

  async fetchLinkedSections(
    termCode: string,
    courseReferenceNumber: string
  ): Promise<FetchLinkedSectionsResponse> {
    const params = new URLSearchParams({
      term: termCode,
      courseReferenceNumber,
    });
    const url = `${this.prefix}/searchResults/fetchLinkedSections?${params}`;
    const res = await this.doFetch(url, { headers: this.xhrHeaders() });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `fetchLinkedSections failed: ${res.status} ${text.slice(0, 200)}`
      );
    }
    try {
      return JSON.parse(text) as FetchLinkedSectionsResponse;
    } catch {
      return {};
    }
  }

  /**
   * Full session bootstrap for a term: term selection → POST term → class search.
   */
  async establishSessionForTerm(termCode: string): Promise<void> {
    await this.getTermSelectionHtml();
    await this.postTermSearch(termCode);
    await this.getClassSearchHtml();
  }
}

export function buildLinkedRepresentativeCrns(
  rows: SearchResultsRow[]
): string[] {
  const byKey = new Map<string, string>();
  for (const row of rows) {
    if (!row.isSectionLinked) continue;
    const term = String(row.term ?? "");
    const sub = String(row.subject ?? "");
    const num = String(row.courseNumber ?? "");
    const link = String(row.linkIdentifier ?? "");
    const crn = row.courseReferenceNumber;
    if (typeof crn !== "string" || !crn) continue;
    const key = `${term}|${sub}|${num}|${link}`;
    if (!byKey.has(key)) byKey.set(key, crn);
  }
  return [...byKey.values()];
}
