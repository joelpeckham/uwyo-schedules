import { describe, expect, it } from "vitest";
import { escapeIlikePattern } from "./search-escape";

describe("escapeIlikePattern", () => {
  it("escapes percent underscore and backslash for ILIKE ESCAPE", () => {
    expect(escapeIlikePattern("100%")).toBe("100\\%");
    expect(escapeIlikePattern("a_b")).toBe("a\\_b");
    expect(escapeIlikePattern("a\\b")).toBe("a\\\\b");
  });

  it("chains replacements in correct order", () => {
    expect(escapeIlikePattern("%_\\")).toBe("\\%\\_\\\\");
  });
});
