import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "./decodeHtmlEntities";

describe("decodeHtmlEntities", () => {
  it("returns null for null/undefined", () => {
    expect(decodeHtmlEntities(null)).toBeNull();
    expect(decodeHtmlEntities(undefined)).toBeNull();
  });

  it("decodes common named entities", () => {
    expect(decodeHtmlEntities("A &amp; B")).toBe("A & B");
  });
});
