/**
 * Canonical production host. Override locally with NEXT_PUBLIC_SITE_URL (e.g. http://localhost:3000).
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://uwyoschedule.org";

export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p}`;
}

/** Marketing tagline (OG image, hero subcopy). */
export const SITE_TAGLINE = "From course list to class schedule.";

/**
 * Canonical product description. Used by page metadata, openGraph, manifest,
 * and JSON-LD so the same words ship everywhere instead of drifting per file.
 */
export const SITE_DESCRIPTION =
  "Plan your UW week in the class schedule planner: add courses from the live catalog, block busy times, set instructor preferences, and keep a conflict-free calendar in sync. Pin sections, try same-type swaps, compare alternate weeks, and share a link. Independent tool; does not register you.";

/** Short form for Twitter cards, the web manifest, and other tight slots. */
export const SITE_DESCRIPTION_SHORT =
  "UW class schedule planner: conflict-free week, busy times, instructor preferences, pins and swaps, compare alternates, share a link. Not official UW; planning only.";
