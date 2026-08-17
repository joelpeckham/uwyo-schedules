/**
 * Markdown bodies for /llms.txt and /llms-full.txt (llmstxt.info-style).
 * `siteUrl` must have no trailing slash (same as SITE_URL).
 */

import { alsoByJoelMarkdown } from "@/lib/seo/product-graph";

type LlmsTxtOptions = {
  /** When true, mention /instructors/* SEO pages (matches sitemap when SEO_INSTRUCTOR_PAGES is on). */
  includeInstructorPages: boolean;
};

function u(path: string, siteUrl: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${p}`;
}

export function buildLlmsTxt(
  siteUrl: string,
  options: LlmsTxtOptions,
): string {
  const lines: string[] = [
    "# uwyoschedule",
    "> Independent University of Wyoming class schedule planner. Primary surface: `/planner` — add courses from the live UW catalog, block busy times, set instructor preferences, and keep a conflict-free week calendar in sync. Pin sections, same-type swaps, alternate weeks with compare, shareable links, and export. Not official UW; does not register you.",
    "",
    "## Planner capabilities",
    "",
    "- Solver-backed conflict-free week that updates as your course list and constraints change",
    "- Busy-time blackouts and per-course instructor filters",
    "- Section pins and same-type drag swaps on the week calendar",
    "- Page alternate conflict-free weeks; keep favorites and compare two side by side",
    "- Share link restores course list and blackouts (not section pins)",
    "- Filters: open seats only, exclude TBA, exclude online or async",
    "- Linked lecture, lab, and discussion sections treated as one choice when the catalog requires it",
    "",
    "## Key pages",
    "",
    `- [Planner](${u("/planner", siteUrl)}): Main interactive planner — term picker, course list, week calendar, preferences, compare, share.`,
    `- [Home](${u("/", siteUrl)}): Marketing landing; links to the planner.`,
    `- [Courses](${u("/courses", siteUrl)}): Browse courses by subject (stable catalog URLs).`,
    `- [Terms](${u("/terms", siteUrl)}): Browse terms available in the app.`,
    `- [About](${u("/about", siteUrl)}): Scope, independence from UW, and how we use UW course catalog data.`,
    `- [FAQ](${u("/faq", siteUrl)}): How the planner works, data freshness, registration.`,
    "",
    "## What we do not do",
    "",
    "- Not affiliated with the University of Wyoming.",
    "- Do not enroll you or replace WyoWeb registration.",
    "- Confirm CRN, prerequisites, seat counts, and linked labs in official UW systems before registering.",
    "",
    "## Data",
    "",
    "Section and meeting data come from the public UW course catalog, cached for speed, refreshed on a schedule. Details can change after our last sync.",
    "",
    "## Machine-readable discovery",
    "",
    `- [Sitemap](${u("/sitemap.xml", siteUrl)}): All indexable URLs.`,
    `- [Robots](${u("/robots.txt", siteUrl)}): Crawl rules (API routes are disallowed).`,
    `- [Full LLM context](${u("/llms-full.txt", siteUrl)}): Longer site description and URL patterns.`,
    "",
    alsoByJoelMarkdown("uwyoschedule").trimEnd(),
  ];

  if (options.includeInstructorPages) {
    lines.push(
      "",
      "## Optional SEO pages",
      "",
      `When enabled, instructor profile pages may appear under [${siteUrl}/instructors/](${u("/instructors/", siteUrl)}) (see sitemap).`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

export function buildLlmsFullTxt(
  siteUrl: string,
  options: LlmsTxtOptions,
): string {
  const instructorNote = options.includeInstructorPages
    ? "Instructor profile pages may be indexed at `/instructors/{slug}` when that feature flag is enabled in deployment."
    : "Instructor profile URLs are not published in the sitemap by default.";

  return `# uwyoschedule — full context for AI systems
> Independent UW class schedule planner. \`/planner\` is the primary interactive product: solver-backed conflict-free week, preferences, calendar refinements, alternates, compare, and share. Built on cached UW course catalog data. Not official UW. Planning only, not registration.

## Product behavior

- **Primary surface:** \`/planner\` — pick a term, add courses, set optional instructor filters, busy-time blackouts, and schedule filters; the planner continuously resolves a conflict-free week (not a browsable list of full schedules).
- **Refinements:** Section pins and same-type drag swaps on the week calendar; page through alternate conflict-free weeks; keep favorites and compare two weeks side by side.
- **Share:** Encoded \`?s=\` links restore courses (as wish-list rows) and blackouts for the same term. Section pins are not applied from share links — the recipient confirms sections in the planner.
- **Export:** Calendar export and share link from the planner UI.
- **Linked sections:** Lecture, lab, and discussion combinations required by the catalog are treated as single choices.
- **Catalog browsing:** \`/courses\` and \`/terms\` support discovery; the planner is where schedules are built.
- Seat counts and meetings reflect our last ingest; they can drift from the live catalog until the next sync.

## URL patterns (human-readable)

- \`/\` — Landing (marketing; use \`/planner\` for the product).
- \`/planner\` — Main planner UI.
- \`/courses\` — Subject index for catalog browsing.
- \`/courses/{subject}\` — Courses for a subject (subject is a path segment; see site for encoding).
- \`/courses/{subject}/{number}\` — Course detail (number is typically lowercase in URLs).
- \`/terms\` — Term list.
- \`/terms/{termCode}\` — Single term overview. URLs use the Banner term code; page titles and headings use the human name (e.g. Fall 2026).
- \`/terms/{termCode}/{subject}\` — Subjects/courses for that term; same code vs. display name as above.
- \`/about\`, \`/faq\` — Editorial pages.

${instructorNote}

## Canonical site

Primary production host: \`${siteUrl}\`. If you fetched this file from another host, treat that host as the deployment origin and prefer absolute links inside this file that match the same origin.

## Exhaustive URL list

For every current indexable URL (including dynamic term and course pages), use the sitemap:

- [${siteUrl}/sitemap.xml](${u("/sitemap.xml", siteUrl)})

## Related files

- [${siteUrl}/llms.txt](${u("/llms.txt", siteUrl)}) — Short curated map.
- [${siteUrl}/robots.txt](${u("/robots.txt", siteUrl)}) — Crawler access rules.

${alsoByJoelMarkdown("uwyoschedule")}
`;
}

export function instructorPagesEnabledFromEnv(): boolean {
  const v = process.env.SEO_INSTRUCTOR_PAGES;
  return v === "1" || v === "true";
}
