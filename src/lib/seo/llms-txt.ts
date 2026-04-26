/**
 * Markdown bodies for /llms.txt and /llms-full.txt (llmstxt.info-style).
 * `siteUrl` must have no trailing slash (same as SITE_URL).
 */

export type LlmsTxtOptions = {
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
    "> Independent University of Wyoming class schedule planner for UW students: search Banner catalog data, combine sections, and page through conflict-free weekly schedules. Not an official UW product; does not register you for classes.",
    "",
    "## Key pages",
    "",
    `- [Home](${u("/", siteUrl)}): Marketing landing and entry to the planner.`,
    `- [Planner](${u("/planner", siteUrl)}): Interactive term picker, course bag, schedule solver, and week calendar.`,
    `- [Courses](${u("/courses", siteUrl)}): Browse courses by subject (stable catalog URLs).`,
    `- [Terms](${u("/terms", siteUrl)}): Browse Banner terms available in the app.`,
    `- [About](${u("/about", siteUrl)}): Scope, independence from UW, and how we use Banner data.`,
    `- [FAQ](${u("/faq", siteUrl)}): Data freshness, registration, linked sections, preferences, and mobile use.`,
    "",
    "## What we do not do",
    "",
    "- We are not affiliated with the University of Wyoming.",
    "- We do not enroll you or replace WyoWeb/Banner registration.",
    "- Always confirm CRN, prerequisites, seat counts, and linked labs in official UW systems before registering.",
    "",
    "## Data",
    "",
    "Section and meeting data are ingested from the public UW Banner catalog (same system behind WyoWeb), cached for speed, and refreshed on a schedule. Details can change in Banner after our last sync.",
    "",
    "## Machine-readable discovery",
    "",
    `- [Sitemap](${u("/sitemap.xml", siteUrl)}): All indexable URLs.`,
    `- [Robots](${u("/robots.txt", siteUrl)}): Crawl rules (API routes are disallowed).`,
    `- [Full LLM context](${u("/llms-full.txt", siteUrl)}): Longer site description and URL patterns.`,
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
> Same product summary as /llms.txt: an independent UW student planner built on cached Banner catalog data, with a solver for conflict-free schedules. Not official UW; planning only, not registration.

## Product behavior

- Users pick a Banner term, add courses (and sections where needed), set optional instructor preferences and busy-time blackouts, then request valid weekly schedules.
- Linked lecture/lab or discussion sections from Banner are treated as combined choices so incompatible splits are avoided.
- Seat counts and meetings reflect our last ingest; they can drift from live Banner until the next sync.

## URL patterns (human-readable)

- \`/\` — Landing.
- \`/planner\` — Main planner UI.
- \`/courses\` — Subject index for catalog browsing.
- \`/courses/{subject}\` — Courses for a subject (subject is a path segment; see site for encoding).
- \`/courses/{subject}/{number}\` — Course detail (number is typically lowercase in URLs).
- \`/terms\` — Term list.
- \`/terms/{termCode}\` — Single term overview.
- \`/terms/{termCode}/{subject}\` — Subjects/courses for that term.
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

`;
}

export function instructorPagesEnabledFromEnv(): boolean {
  const v = process.env.SEO_INSTRUCTOR_PAGES;
  return v === "1" || v === "true";
}
