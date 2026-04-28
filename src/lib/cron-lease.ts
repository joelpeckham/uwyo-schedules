import { sql } from "drizzle-orm";
import { createDb } from "@/db/index";
import * as schema from "@/db/schema";

/**
 * Atomic UPSERT-with-condition: insert a fresh lease for `key` if none exists,
 * or steal it if the previous holder's `acquired_at` is older than the lease
 * window. The `RETURNING` row tells us whether we won the race.
 *
 * Two simultaneous cron invocations both run this statement: only the one
 * whose insert/update fires the WHERE clause will get a returned row; the
 * other gets an empty result and must skip the work. This gives the cron
 * route the idempotency the workflow `start` API does not otherwise provide.
 */
export async function tryAcquireCronLease(
  key: string,
  leaseMs: number,
): Promise<boolean> {
  const db = createDb();
  const ms = Math.max(1, Math.floor(leaseMs));
  const rows = await db
    .insert(schema.cronLease)
    .values({ key, acquiredAt: new Date() })
    .onConflictDoUpdate({
      target: schema.cronLease.key,
      set: { acquiredAt: new Date() },
      setWhere: sql`cron_lease.acquired_at < NOW() - (${ms}::bigint || ' milliseconds')::interval`,
    })
    .returning({ key: schema.cronLease.key });
  return rows.length > 0;
}

