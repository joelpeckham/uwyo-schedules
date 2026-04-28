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

/**
 * Canonical product description. Used by page metadata, openGraph, manifest,
 * and JSON-LD so the same words ship everywhere instead of drifting per file.
 */
export const SITE_DESCRIPTION =
  "Plan your University of Wyoming class schedule. Add courses from the live UW catalog. The planner keeps a conflict-free week in sync as you set preferences, mark busy times, and pin or swap sections on the calendar.";

/** Short form for Twitter cards, the web manifest, and other tight slots. */
export const SITE_DESCRIPTION_SHORT =
  "Plan your University of Wyoming class schedule. The planner keeps a conflict-free week in sync as you add courses, set preferences, and mark busy times.";

/** One-line tagline used on hero, OG image, and the design system doc. */
export const SITE_TAGLINE = "From course list to class schedule.";
