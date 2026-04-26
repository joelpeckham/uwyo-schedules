import { describe, expect, it } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt } from "./llms-txt";

const base = "https://uwyoschedule.org";

function h1Count(md: string): number {
  return md.split("\n").filter((line) => /^# [^#]/.test(line)).length;
}

describe("buildLlmsTxt", () => {
  it("has one H1 and blockquote immediately after (llmstxt.info shape)", () => {
    const md = buildLlmsTxt(base, { includeInstructorPages: false });
    const lines = md.split("\n");
    expect(lines[0]).toBe("# uwyoschedule");
    expect(lines[1]?.startsWith(">")).toBe(true);
    expect(h1Count(md)).toBe(1);
  });

  it("uses absolute URLs for key routes", () => {
    const md = buildLlmsTxt(base, { includeInstructorPages: false });
    expect(md).toContain(`${base}/planner`);
    expect(md).toContain(`${base}/sitemap.xml`);
  });

  it("mentions optional instructor pages when enabled", () => {
    const on = buildLlmsTxt(base, { includeInstructorPages: true });
    expect(on).toContain("/instructors/");
    const off = buildLlmsTxt(base, { includeInstructorPages: false });
    expect(off).not.toContain("## Optional SEO pages");
  });
});

describe("buildLlmsFullTxt", () => {
  it("has one H1 and blockquote on the following line", () => {
    const md = buildLlmsFullTxt(base, { includeInstructorPages: false });
    const lines = md.split("\n");
    expect(lines[0]).toMatch(/^# uwyoschedule/);
    expect(lines[1]?.startsWith(">")).toBe(true);
    expect(h1Count(md)).toBe(1);
  });

  it("points to sitemap and llms.txt", () => {
    const md = buildLlmsFullTxt(base, { includeInstructorPages: false });
    expect(md).toContain(`${base}/sitemap.xml`);
    expect(md).toContain(`${base}/llms.txt`);
  });
});
