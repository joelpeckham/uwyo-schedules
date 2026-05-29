import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { releaseCronLease, tryAcquireCronLease } from "@/lib/cron-lease";
import { descriptionsIngestWorkflow } from "@/workflows/descriptions-ingest";

/**
 * Hot-term description preload can run for hours (one Banner call per CRN).
 * Lease window should cover a full daily run without overlapping starts.
 */
const BANNER_DESCRIPTIONS_LEASE_MS = 6 * 60 * 60_000;

const LEASE_KEY = "banner-descriptions";

/**
 * Vercel Cron: GET with `Authorization: Bearer ${CRON_SECRET}`.
 * Preloads course/section descriptions for `BANNER_PRIMARY_TERM_CODE`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const termCode = process.env.BANNER_PRIMARY_TERM_CODE;
  if (!termCode) {
    const res = NextResponse.json(
      { error: "BANNER_PRIMARY_TERM_CODE is not set" },
      { status: 500 },
    );
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const acquired = await tryAcquireCronLease(
    LEASE_KEY,
    BANNER_DESCRIPTIONS_LEASE_MS,
  );
  if (!acquired) {
    const res = NextResponse.json({
      started: false,
      skipped: true,
      reason: "another invocation already holds the lease",
    });
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  try {
    await start(descriptionsIngestWorkflow, [{ termCode }]);
  } catch (err) {
    try {
      await releaseCronLease(LEASE_KEY);
    } catch (releaseErr) {
      console.error(
        "banner-descriptions cron: failed to release lease after start error",
        releaseErr,
      );
    }
    console.error("banner-descriptions cron: workflow start failed", err);
    const res = NextResponse.json(
      {
        started: false,
        error: "Workflow start failed; lease released for retry.",
      },
      { status: 500 },
    );
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const res = NextResponse.json({
    started: true,
    termCode,
    note:
      "Description preload workflow was scheduled; runs asynchronously. Check deployment logs for completion.",
  });
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
