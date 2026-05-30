import { createDb } from "@/db";
import * as schema from "@/db/schema";
import {
  DESCRIPTION_STALE_HARD_DAYS,
  DESCRIPTION_STALE_SOFT_DAYS,
  DESCRIPTION_STALE_SOFT_SAMPLE_RATE,
  ensureSectionDescriptions,
} from "@/lib/planner/ensure-section-descriptions";
import {
  emptyIngestStepStats,
  logIngestWorkflowSummary,
  mergeIngestStepStats,
  type IngestStepStats,
} from "@/lib/ingest/stats";
import { seoCrnTag } from "@/lib/seo/cache-tags";
import { and, eq, isNull, or, sql } from "drizzle-orm";
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

async function listStaleCrnsStep(termCode: string): Promise<{
  crns: string[];
  stats: IngestStepStats;
}> {
  "use step";
  const db = createDb();
  const stats = emptyIngestStepStats();
  stats.db.selects += 1;
  const rows = await db
    .select({ crn: schema.sections.crn })
    .from(schema.sections)
    .where(
      and(
        eq(schema.sections.termCode, termCode),
        or(
          isNull(schema.sections.descriptionsFetchedAt),
          sql`${schema.sections.descriptionsFetchedAt} < now() - make_interval(days => ${DESCRIPTION_STALE_HARD_DAYS})`,
          sql`(
            ${schema.sections.descriptionsFetchedAt} < now() - make_interval(days => ${DESCRIPTION_STALE_SOFT_DAYS})
            AND random() < ${DESCRIPTION_STALE_SOFT_SAMPLE_RATE}
          )`,
        ),
      ),
    );
  const crns = rows.map((r) => r.crn);
  return { crns, stats };
}

async function fetchDescriptionBatchStep(args: {
  termCode: string;
  crns: string[];
}): Promise<{ fetched: number; stats: IngestStepStats }> {
  "use step";
  if (args.crns.length === 0) {
    return { fetched: 0, stats: emptyIngestStepStats() };
  }
  if (process.env.DEBUG_INGEST === "1") {
    console.log(
      "[descriptions-ingest] fetchDescriptionBatchStep",
      args.termCode,
      args.crns.length,
    );
  }
  const db = createDb();
  const stats = await ensureSectionDescriptions(db, args.termCode, args.crns);
  for (const crn of args.crns) {
    revalidateTag(seoCrnTag(args.termCode, crn), "max");
  }
  return { fetched: args.crns.length, stats };
}

export async function descriptionsIngestWorkflow(
  input: DescriptionsIngestWorkflowInput,
) {
  "use workflow";
  const { termCode } = input;
  const { crns: stale, stats: listStats } = await listStaleCrnsStep(termCode);
  if (stale.length === 0) {
    logIngestWorkflowSummary("descriptions-ingest", listStats, {
      termCode,
      batches: 0,
      crns: 0,
    });
    return {
      ok: true as const,
      termCode,
      batches: 0,
      crns: 0,
      stats: listStats,
    };
  }

  const batches = chunk(stale, BATCH_SIZE);
  let totalFetched = 0;
  let stats = listStats;
  for (const crns of batches) {
    const { fetched, stats: batchStats } = await fetchDescriptionBatchStep({
      termCode,
      crns,
    });
    totalFetched += fetched;
    stats = mergeIngestStepStats(stats, batchStats);
  }

  logIngestWorkflowSummary("descriptions-ingest", stats, {
    termCode,
    batches: batches.length,
    crns: totalFetched,
  });

  return {
    ok: true as const,
    termCode,
    batches: batches.length,
    crns: totalFetched,
    stats,
  };
}
