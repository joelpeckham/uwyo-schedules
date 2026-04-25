import type { TermCatalogBundle } from "./bundle";
import { parseTermCatalogPayload } from "./term-catalog-file";

/**
 * Same-origin proxy path (private Blob). Query must use `pathname` from the manifest.
 */
export function termCatalogProxyUrl(pathname: string): string {
  const q = new URLSearchParams({ pathname });
  return `/api/catalog/term?${q.toString()}`;
}

/**
 * Fetch gzipped term catalog via the app proxy, gunzip in the browser, parse JSON.
 * Call only from the client (requires `DecompressionStream`).
 */
export async function fetchTermCatalogGzipJson(
  pathname: string
): Promise<unknown> {
  const res = await fetch(termCatalogProxyUrl(pathname));
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Term catalog fetch failed (${res.status}): ${errText.slice(0, 200)}`
    );
  }
  if (!res.body) {
    throw new Error("Term catalog fetch: empty response body");
  }
  const Decomp = (
    globalThis as typeof globalThis & {
      DecompressionStream?: typeof DecompressionStream;
    }
  ).DecompressionStream;
  if (!Decomp) {
    throw new Error("DecompressionStream is not available in this environment");
  }
  const ds = new Decomp("gzip");
  const text = await new Response(res.body.pipeThrough(ds)).text();
  return JSON.parse(text) as unknown;
}

export async function fetchTermCatalogBundle(
  pathname: string,
  options?: { termDescription?: string }
): Promise<TermCatalogBundle> {
  const data = await fetchTermCatalogGzipJson(pathname);
  const parsed = parseTermCatalogPayload(data, {
    termDescription: options?.termDescription,
  });
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.bundle;
}
