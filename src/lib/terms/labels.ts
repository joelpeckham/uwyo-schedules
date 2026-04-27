import { createDb } from "@/db/index";
import type { Database } from "@/db/index";
import * as schema from "@/db/schema";
import { decodeHtmlEntities } from "@/lib/text/decodeHtmlEntities";
import { desc, eq } from "drizzle-orm";
import { cache } from "react";

export async function getLatestTermRow(
  db: Database,
): Promise<{ code: string; description: string } | null> {
  const [row] = await db
    .select({
      code: schema.terms.code,
      description: schema.terms.description,
    })
    .from(schema.terms)
    .orderBy(desc(schema.terms.code))
    .limit(1);
  if (!row) return null;
  return {
    code: row.code,
    description: decodeHtmlEntities(row.description) ?? row.description,
  };
}

/** One lookup per request when used from both `generateMetadata` and a server page. */
export const getTermDescriptionByCode = cache(
  async (code: string): Promise<string | null> => {
    const db = createDb();
    const [row] = await db
      .select({ description: schema.terms.description })
      .from(schema.terms)
      .where(eq(schema.terms.code, code))
      .limit(1);
    if (!row?.description) return null;
    return decodeHtmlEntities(row.description) ?? row.description;
  },
);
