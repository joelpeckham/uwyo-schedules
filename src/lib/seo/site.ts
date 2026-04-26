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
