/**
 * Parse Banner HTML for synchronizer token (CSRF-style).
 * Case-insensitive on meta name="synchronizerToken".
 */
export function parseSynchronizerToken(html: string): string | null {
  const re =
    /<meta\s+[^>]*name\s*=\s*["']?synchronizerToken["']?[^>]*content\s*=\s*["']([^"']+)["'][^>]*>/i;
  const m = html.match(re);
  if (m?.[1]) {
    return m[1];
  }
  const re2 =
    /<meta\s+[^>]*content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']?synchronizerToken["']?[^>]*>/i;
  const m2 = html.match(re2);
  return m2?.[1] ?? null;
}
