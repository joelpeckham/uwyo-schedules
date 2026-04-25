import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  TERM_CATALOG_BLOB_SCHEMA_VERSION,
  parseTermCatalogPayload,
  type TermCatalogGzipPayload,
} from "./term-catalog-file";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

describe("parseTermCatalogPayload", () => {
  it("builds bundle from merged gzip payload shape", () => {
    const payload: TermCatalogGzipPayload = {
      schemaVersion: TERM_CATALOG_BLOB_SCHEMA_VERSION,
      runId: "run-1",
      termCode: "202510",
      termDescription: "Fall 2025",
      builtAt: "2026-01-01T00:00:00.000Z",
      bySubject: {
        PHYS: {
          rows: [
            {
              subject: "PHYS",
              courseNumber: "1050",
              courseReferenceNumber: "10001",
            },
          ],
        },
      },
      linkedByCrn: {
        "10001": {
          fetchedAt: "2026-01-01T00:01:00.000Z",
          response: { linkedData: [] },
        },
      },
    };

    const out = parseTermCatalogPayload(payload);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.bundle.termCode).toBe("202510");
    expect(out.bundle.termDescription).toBe("Fall 2025");
    expect(out.bundle.sectionRows).toHaveLength(1);
    expect(out.bundle.courses.get("PHYS|1050")).toHaveLength(1);
    expect(out.bundle.linkedByCrn.get("10001")?.fetchedAt).toBe(
      "2026-01-01T00:01:00.000Z"
    );
  });

  it("rejects wrong schemaVersion", () => {
    const out = parseTermCatalogPayload({ schemaVersion: 1, termCode: "x" });
    expect(out.ok).toBe(false);
  });
});

describe("term catalog gzip round-trip", () => {
  it("gzip then gunzip matches parseTermCatalogPayload", async () => {
    const payload: TermCatalogGzipPayload = {
      schemaVersion: TERM_CATALOG_BLOB_SCHEMA_VERSION,
      runId: "r",
      termCode: "T1",
      builtAt: "2026-01-01T00:00:00.000Z",
      bySubject: {
        MATH: { rows: [{ subject: "MATH", courseNumber: "2200" }] },
      },
      linkedByCrn: {},
    };
    const json = JSON.stringify(payload);
    const gz = await gzipAsync(Buffer.from(json, "utf8"));
    const round = JSON.parse(
      (await gunzipAsync(gz)).toString("utf8")
    ) as unknown;
    const out = parseTermCatalogPayload(round);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.bundle.sectionRows).toHaveLength(1);
  });
});
