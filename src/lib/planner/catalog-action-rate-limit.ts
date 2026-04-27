/** Simple in-memory sliding window for unauthenticated catalog server actions. */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 80;

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export function takeCatalogActionRateLimit(clientKey: string): boolean {
  const now = Date.now();
  let b = buckets.get(clientKey);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { count: 0, windowStart: now };
    buckets.set(clientKey, b);
  }
  if (b.count >= MAX_REQUESTS) return false;
  b.count += 1;
  return true;
}
