import { sql } from "drizzle-orm";
import { createDb } from "@/db/index";
import * as schema from "@/db/schema";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 80;
// Per-instance fallback used only when the DB-backed limiter throws. Smaller
// than the global cap so a misbehaving DB cannot turn into an abuse vector.
const FALLBACK_MAX_REQUESTS = 20;
const FALLBACK_MAX_KEYS = 5_000;

type FallbackBucket = { windowStart: number; count: number };
const fallbackBuckets = new Map<string, FallbackBucket>();

function takeFallbackBudget(clientKey: string): boolean {
  if (fallbackBuckets.size > FALLBACK_MAX_KEYS) {
    fallbackBuckets.clear();
  }
  const now = Date.now();
  const existing = fallbackBuckets.get(clientKey);
  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    fallbackBuckets.set(clientKey, { windowStart: now, count: 1 });
    return true;
  }
  existing.count += 1;
  return existing.count <= FALLBACK_MAX_REQUESTS;
}

/**
 * Shared, cross-instance fixed-window rate limit. Each call atomically rolls
 * the window forward when expired or increments `count`, so two concurrent
 * Vercel function instances cannot both squeeze past the cap. On a database
 * error we degrade to a much smaller per-instance budget instead of failing
 * open so a transient outage cannot become an abuse vector.
 */
export async function takeCatalogActionRateLimit(
  clientKey: string,
): Promise<boolean> {
  const ms = WINDOW_MS;
  try {
    const rows = await createDb()
      .insert(schema.catalogActionRateLimit)
      .values({ clientKey, windowStart: new Date(), count: 1 })
      .onConflictDoUpdate({
        target: schema.catalogActionRateLimit.clientKey,
        set: {
          count: sql`CASE WHEN ${schema.catalogActionRateLimit.windowStart} < NOW() - (${ms}::bigint || ' milliseconds')::interval THEN 1 ELSE ${schema.catalogActionRateLimit.count} + 1 END`,
          windowStart: sql`CASE WHEN ${schema.catalogActionRateLimit.windowStart} < NOW() - (${ms}::bigint || ' milliseconds')::interval THEN NOW() ELSE ${schema.catalogActionRateLimit.windowStart} END`,
        },
      })
      .returning({ count: schema.catalogActionRateLimit.count });
    const count = rows[0]?.count ?? 0;
    return count <= MAX_REQUESTS;
  } catch (err) {
    console.error("catalog-action-rate-limit: db error, using fallback", err);
    return takeFallbackBudget(clientKey);
  }
}
