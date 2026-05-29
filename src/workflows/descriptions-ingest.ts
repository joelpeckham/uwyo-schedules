import { createDb } from "@/db";
import * as schema from "@/db/schema";
import { ensureSectionDescriptions } from "@/lib/planner/ensure-section-descriptions";
import { seoCrnTag } from "@/lib/seo/cache-tags";
import { and, eq, isNull } from "drizzle-orm";
import { revalidateTag } from "next/cache";

/** CRNs per workflow step — keeps each step under Vercel duration limits. */
const BATCH_SIZE = 40;

type DescriptionsIngestWorkflowInput = {
  termCode: string;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function listMissingCrnsStep(termCode: string): Promise<string[]> {
  "use step";
  const db = createDb();
  const rows = await db
    .select({ crn: schema.sections.crn })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.termCode, termCode),
        isNull(schema.sections.descriptionsFetchedAt),
      ),
    );
  const crns = rows.map((r) => r.crn);
  console.log(
    `[descriptions-ingest] term ${termCode}: ${crns.length} CRNs missing descriptions`,
  );
  return crns;
}

async function fetchDescriptionBatchStep(args: {
  termCode: string;
  crns: string[];
}): Promise<{ fetched: number }> {
  "use step";
  if (args.crns.length === 0) {
    return { fetched: 0 };
  }
  if (process.env.DEBUG_INGEST === "1") {
    console.log(
      "[descriptions-ingest] fetchDescriptionBatchStep",
      args.termCode,
      args.crns.length,
    );
  }
  const db = createDb();
  await ensureSectionDescriptions(db, args.termCode, args.crns);
  for (const crn of args.crns) {
    revalidateTag(seoCrnTag(args.termCode, crn), "max");
  }
  return { fetched: args.crns.length };
}

export async function descriptionsIngestWorkflow(
  input: DescriptionsIngestWorkflowInput,
) {
  "use workflow";
  const { termCode } = input;
  const missing = await listMissingCrnsStep(termCode);
  if (missing.length === 0) {
    return {
      ok: true as const,
      termCode,
      batches: 0,
      crns: 0,
    };
  }

  const batches = chunk(missing, BATCH_SIZE);
  let totalFetched = 0;
  for (const crns of batches) {
    const { fetched } = await fetchDescriptionBatchStep({ termCode, crns });
    totalFetched += fetched;
  }

  return {
    ok: true as const,
    termCode,
    batches: batches.length,
    crns: totalFetched,
  };
}
