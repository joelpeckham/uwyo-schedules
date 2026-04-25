import { get, list, put } from "@vercel/blob";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { scrapeStepLog } from "../scrape-log";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

function requireToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set — add it in Vercel project env or .env.local"
    );
  }
  return token;
}

/**
 * Must match the Vercel Blob **store** access mode.
 * - `private` (default): use with a private store; `put` and `get` use private access.
 * - `public`: use only if the store allows public blobs (legacy / public-only stores).
 */
function blobStoreAccess(): "public" | "private" {
  return process.env.BLOB_STORE_ACCESS === "public" ? "public" : "private";
}

async function putCatalogJsonString(
  pathname: string,
  json: string
): Promise<{ url: string; pathname: string }> {
  const token = requireToken();
  const access = blobStoreAccess();
  const blob = await put(pathname, json, {
    access,
    token,
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
  });
  return { url: blob.url, pathname: blob.pathname };
}

async function putCatalogGzipBuffer(
  pathname: string,
  buffer: Buffer
): Promise<{ url: string; pathname: string }> {
  const token = requireToken();
  const access = blobStoreAccess();
  const blob = await put(pathname, buffer, {
    access,
    token,
    addRandomSuffix: false,
    contentType: "application/gzip",
  });
  return { url: blob.url, pathname: blob.pathname };
}

/** Plain gzip upload (no `"use step"`). */
export async function putCatalogGzipJson(
  pathname: string,
  body: unknown
): Promise<{ url: string; pathname: string }> {
  const json = JSON.stringify(body);
  const buffer = await gzipAsync(Buffer.from(json, "utf8"));
  return putCatalogGzipBuffer(pathname, buffer);
}

export async function blobPutGzipJsonStep(
  pathname: string,
  body: unknown
): Promise<{ url: string; pathname: string }> {
  "use step";
  const json = JSON.stringify(body);
  const raw = Buffer.from(json, "utf8");
  const gz = await gzipAsync(raw);
  scrapeStepLog("blobPutGzipJsonStep:start", {
    pathname,
    approxUncompressedBytes: raw.length,
    approxGzipBytes: gz.length,
  });
  const out = await putCatalogGzipBuffer(pathname, gz);
  scrapeStepLog("blobPutGzipJsonStep:done", { pathname: out.pathname });
  return out;
}

/** Plain Blob upload (no `"use step"`). Call from inside another step to avoid nested durable steps per `put`. */
export async function putCatalogJson(
  pathname: string,
  body: unknown
): Promise<{ url: string; pathname: string }> {
  return putCatalogJsonString(pathname, JSON.stringify(body));
}

export async function blobPutJsonStep(
  pathname: string,
  body: unknown
): Promise<{ url: string; pathname: string }> {
  "use step";
  const json = JSON.stringify(body);
  scrapeStepLog("blobPutJsonStep:start", {
    pathname,
    approxBytes: Buffer.byteLength(json, "utf8"),
  });
  const out = await putCatalogJsonString(pathname, json);
  scrapeStepLog("blobPutJsonStep:done", { pathname: out.pathname });
  return out;
}

export async function blobListStep(prefix: string) {
  "use step";
  scrapeStepLog("blobListStep:start", { prefix });
  const token = requireToken();
  const { blobs } = await list({ prefix, token });
  const mapped = blobs.map((b) => ({ url: b.url, pathname: b.pathname }));
  scrapeStepLog("blobListStep:done", { prefix, count: mapped.length });
  return mapped;
}

/** Read JSON blob by pathname (App Router, scripts). Not a durable step. */
export async function readCatalogBlobJson(pathname: string): Promise<unknown> {
  const token = requireToken();
  const access = blobStoreAccess();
  const result = await get(pathname, { access, token });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(
      `blob get failed for ${pathname}: ${result ? String(result.statusCode) : "null"}`
    );
  }
  const text = await new Response(result.stream).text();
  return JSON.parse(text) as unknown;
}

/** Read JSON blob by pathname (works for private stores; uses SDK `get`, not anonymous fetch). */
export async function blobFetchJsonStep(pathname: string): Promise<unknown> {
  "use step";
  scrapeStepLog("blobFetchJsonStep:start", { pathname });
  const out = await readCatalogBlobJson(pathname);
  scrapeStepLog("blobFetchJsonStep:done", { pathname });
  return out;
}

/** Read gzip-compressed JSON blob (App Router, scripts). */
export async function readCatalogBlobGzipJson(
  pathname: string
): Promise<unknown> {
  const token = requireToken();
  const access = blobStoreAccess();
  const result = await get(pathname, { access, token });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(
      `blob get failed for ${pathname}: ${result ? String(result.statusCode) : "null"}`
    );
  }
  const buf = Buffer.from(await new Response(result.stream).arrayBuffer());
  const text = (await gunzipAsync(buf)).toString("utf8");
  return JSON.parse(text) as unknown;
}

export async function blobFetchGzipJsonStep(
  pathname: string
): Promise<unknown> {
  "use step";
  scrapeStepLog("blobFetchGzipJsonStep:start", { pathname });
  const out = await readCatalogBlobGzipJson(pathname);
  scrapeStepLog("blobFetchGzipJsonStep:done", { pathname });
  return out;
}

/** Raw blob bytes (e.g. gzip) for streaming from a Route Handler. */
export async function readCatalogBlobRawStream(
  pathname: string
): Promise<ReadableStream<Uint8Array>> {
  const token = requireToken();
  const access = blobStoreAccess();
  const result = await get(pathname, { access, token });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(
      `blob get failed for ${pathname}: ${result ? String(result.statusCode) : "null"}`
    );
  }
  return result.stream;
}
