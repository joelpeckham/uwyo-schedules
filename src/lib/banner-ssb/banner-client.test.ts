import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLinkedRepresentativeCrns } from "./banner-client";
import type { SearchResultsResponse, SearchResultsRow } from "./types";

describe("buildLinkedRepresentativeCrns", () => {
  it("dedupes by term+subject+courseNumber+linkIdentifier using fixture searchResults", () => {
    const fixturePath = join(
      process.cwd(),
      "docs/banner-ssb-fixtures/07-searchResults-PHYS-page0.json"
    );
    const raw = readFileSync(fixturePath, "utf8");
    const parsed = JSON.parse(raw) as SearchResultsResponse;
    expect(parsed.data).toBeTruthy();
    const crns = buildLinkedRepresentativeCrns(
      (parsed.data ?? []) as SearchResultsRow[]
    );
    expect(crns.length).toBeGreaterThan(0);
    expect(crns).toContain("10224");
  });
});
