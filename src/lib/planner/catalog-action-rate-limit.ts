import { sql } from "drizzle-orm";
import { createDb } from "@/db/index";
import * as schema from "@/db/schema";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 80;

/**
 * Shared, cross-instance fixed-window rate limit. Each call atomically rolls
 * the window forward when expired or increments `count`, so two concurrent
 * Vercel function instances cannot both squeeze past the cap. Falls back to
 * "allow" on a database error so a transient outage cannot lock everyone out
 * of the public catalog actions.
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
  } catch {
    return true;
  }
}
