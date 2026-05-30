import {
  BANNER_USER_AGENT,
  RETRY_ATTEMPTS,
  RETRY_BASE_MS,
  SEARCH_RESULTS_PAGE_SIZE,
  SUBJECT_PAGE_SIZE,
  TERMS_MAX,
} from "./constants";
import {
  emptyBannerStats,
  recordBannerRequest,
  type BannerCallStats,
} from "@/lib/ingest/stats";

/**
 * Per-request timeout for Banner HTTP calls. Banner SSB occasionally hangs
 * indefinitely; without this the workflow step would block forever and never
 * be retried.
 */
const BANNER_REQUEST_TIMEOUT_MS = 15_000;
import { parseSynchronizerToken } from "./parse-html";
import type {
  BannerSubject,
  BannerTerm,
  LinkedSectionsResponse,
  SearchResultsResponse,
} from "./types";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * HTTP client for Ellucian Banner SSB class search (see docs/banner-ssb-class-search-scraping.md).
 * Scraping must comply with UW terms of use and rate expectations.
 */
export class BannerSsbClient {
  private readonly ssbBase: string;
  private readonly cookieJar = new Map<string, string>();
  private readonly bannerStats: BannerCallStats = emptyBannerStats();
  synchronizerToken: string | null = null;
  /** Final URL after redirects — Referer for XHR and POSTs */
  termSelectionReferer: string | null = null;
  classSearchReferer: string | null = null;

  constructor(origin: string) {
    const trimmed = origin.replace(/\/+$/, "");
    this.ssbBase = `${trimmed}/StudentRegistrationSsb/ssb`;
  }

  getBannerStats(): BannerCallStats {
    return {
      total: this.bannerStats.total,
      retries: this.bannerStats.retries,
      byEndpoint: { ...this.bannerStats.byEndpoint },
    };
  }

  private cookieHeader(): string {
    return [...this.cookieJar.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  private mergeSetCookie(setCookieHeaders: string[]) {
    for (const line of setCookieHeaders) {
      const pair = line.split(";")[0]?.trim();
      if (!pair?.includes("=")) continue;
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (name) this.cookieJar.set(name, value);
    }
  }

  private async rawFetch(url: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", BANNER_USER_AGENT);
    }
    const c = this.cookieHeader();
    if (c) headers.set("Cookie", c);

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      const signal = init.signal
        ? AbortSignal.any([
            init.signal,
            AbortSignal.timeout(BANNER_REQUEST_TIMEOUT_MS),
          ])
        : AbortSignal.timeout(BANNER_REQUEST_TIMEOUT_MS);
      try {
        recordBannerRequest(this.bannerStats, url, this.ssbBase);
        const res = await fetch(url, {
          ...init,
          headers,
          redirect: "follow",
          signal,
        });
        const raw = res.headers.get("set-cookie");
        if (raw) {
          this.mergeSetCookie([raw]);
        }
        const list = res.headers.getSetCookie?.();
        if (list?.length) {
          this.mergeSetCookie(list);
        }
        if (res.status >= 500 && attempt < RETRY_ATTEMPTS) {
          this.bannerStats.retries += 1;
          await delay(RETRY_BASE_MS * attempt);
          continue;
        }
        return res;
      } catch (err) {
        const isAbort =
          err instanceof DOMException && err.name === "AbortError";
        const isTimeout =
          err instanceof DOMException && err.name === "TimeoutError";
        if ((isAbort || isTimeout) && attempt < RETRY_ATTEMPTS) {
          this.bannerStats.retries += 1;
          await delay(RETRY_BASE_MS * attempt);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Banner rawFetch: exhausted retries without returning a response");
  }

  private pathUrl(path: string): string {
    if (path.startsWith("http")) return path;
    return `${this.ssbBase}${path.startsWith("/") ? path : `/${path}`}`;
  }

  /** §4 step 1 — warm session + first token */
  async warmTermSelection(): Promise<void> {
    const url = this.pathUrl("/term/termSelection?mode=search");
    const res = await this.rawFetch(url, { method: "GET" });
    const html = await res.text();
    this.synchronizerToken = parseSynchronizerToken(html);
    this.termSelectionReferer = res.url;
    if (!this.synchronizerToken) {
      throw new Error("Banner SSB: synchronizer token missing after termSelection");
    }
  }

  /** §4 step 2–3 — select term and load class search shell */
  async selectTermAndLoadClassSearch(termCode: string): Promise<void> {
    if (!this.synchronizerToken || !this.termSelectionReferer) {
      throw new Error("Banner SSB: call warmTermSelection before selectTerm");
    }
    const body = new URLSearchParams({ term: termCode }).toString();
    await this.rawFetch(this.pathUrl("/term/search?mode=search"), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Synchronizer-Token": this.synchronizerToken,
        "X-Requested-With": "XMLHttpRequest",
        Referer: this.termSelectionReferer,
        Accept: "*/*",
      },
      body,
    });
    await this.reloadClassSearchHtml();
  }

  async reloadClassSearchHtml(): Promise<void> {
    const res = await this.rawFetch(this.pathUrl("/classSearch/classSearch"), {
      method: "GET",
    });
    const html = await res.text();
    this.synchronizerToken =
      parseSynchronizerToken(html) ?? this.synchronizerToken;
    this.classSearchReferer = res.url;
    if (!this.synchronizerToken) {
      throw new Error("Banner SSB: synchronizer token missing after classSearch");
    }
  }

  private xhrHeaders(): Record<string, string> {
    if (!this.synchronizerToken || !this.classSearchReferer) {
      throw new Error("Banner SSB: class search not loaded (missing token/referer)");
    }
    return {
      "X-Synchronizer-Token": this.synchronizerToken,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: this.classSearchReferer,
    };
  }

  async getTerms(): Promise<BannerTerm[]> {
    const url = this.pathUrl(
      `/classSearch/getTerms?searchTerm=&offset=1&max=${TERMS_MAX}`,
    );
    const res = await this.rawFetch(url, {
      method: "GET",
      headers: this.xhrHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Banner getTerms: HTTP ${res.status}`);
    }
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) {
      return [];
    }
    return data as BannerTerm[];
  }

  /**
   * Paginate `get_subject` until an empty array (1-based `offset` per Banner clients).
   */
  async getAllSubjects(termCode: string): Promise<BannerSubject[]> {
    const subjects: BannerSubject[] = [];
    let page = 1;
    for (;;) {
      const url = this.pathUrl(
        `/classSearch/get_subject?searchTerm=&term=${encodeURIComponent(termCode)}&offset=${page}&max=${SUBJECT_PAGE_SIZE}`,
      );
      const res = await this.rawFetch(url, {
        method: "GET",
        headers: this.xhrHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Banner get_subject page ${page}: HTTP ${res.status}`);
      }
      const chunk = (await res.json()) as unknown;
      if (!Array.isArray(chunk) || chunk.length === 0) {
        break;
      }
      subjects.push(...(chunk as BannerSubject[]));
      page += 1;
    }
    return subjects;
  }

  async resetDataForm(): Promise<void> {
    await this.rawFetch(this.pathUrl("/classSearch/resetDataForm"), {
      method: "POST",
      headers: {
        ...this.xhrHeaders(),
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
    });
  }

  async getSearchResultsPage(
    termCode: string,
    subjectCode: string,
    pageOffset: number,
  ): Promise<SearchResultsResponse> {
    const qs = new URLSearchParams({
      txt_subject: subjectCode,
      txt_term: termCode,
      startDatepicker: "",
      endDatepicker: "",
      pageOffset: String(pageOffset),
      pageMaxSize: String(SEARCH_RESULTS_PAGE_SIZE),
      sortColumn: "subjectDescription",
      sortDirection: "asc",
    });
    const url = this.pathUrl(`/searchResults/searchResults?${qs}`);
    const res = await this.rawFetch(url, {
      method: "GET",
      headers: this.xhrHeaders(),
    });
    if (!res.ok) {
      throw new Error(
        `Banner searchResults ${subjectCode} offset=${pageOffset}: HTTP ${res.status}`,
      );
    }
    return (await res.json()) as SearchResultsResponse;
  }

  async fetchLinkedSections(
    termCode: string,
    anchorCrn: string,
  ): Promise<LinkedSectionsResponse> {
    const qs = new URLSearchParams({
      term: termCode,
      courseReferenceNumber: anchorCrn,
    });
    const url = this.pathUrl(`/searchResults/fetchLinkedSections?${qs}`);
    const res = await this.rawFetch(url, {
      method: "GET",
      headers: this.xhrHeaders(),
    });
    if (!res.ok) {
      throw new Error(
        `Banner fetchLinkedSections ${anchorCrn}: HTTP ${res.status}`,
      );
    }
    const text = await res.text();
    if (text.trim() === "") {
      return {};
    }
    try {
      return JSON.parse(text) as LinkedSectionsResponse;
    } catch (err) {
      const snippet = text.slice(0, 200).replace(/\s+/g, " ");
      throw new Error(
        `Banner fetchLinkedSections ${anchorCrn}: invalid JSON response (status ${res.status}, body starts: "${snippet}")${
          err instanceof Error ? `: ${err.message}` : ""
        }`,
      );
    }
  }

  /** HTML fragment with course description and optional section information text. */
  async getCourseDescriptionHtml(
    termCode: string,
    crn: string,
  ): Promise<string> {
    const qs = new URLSearchParams({
      term: termCode,
      courseReferenceNumber: crn,
    });
    const url = this.pathUrl(`/searchResults/getCourseDescription?${qs}`);
    const res = await this.rawFetch(url, {
      method: "GET",
      headers: this.xhrHeaders(),
    });
    if (!res.ok) {
      throw new Error(
        `Banner getCourseDescription ${crn}: HTTP ${res.status}`,
      );
    }
    return res.text();
  }
}
