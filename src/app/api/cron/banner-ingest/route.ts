import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { bannerIngestWorkflow } from "@/workflows/banner-ingest";
import { releaseCronLease, tryAcquireCronLease } from "@/lib/cron-lease";

/**
 * How long a banner-ingest cron lease is honored. The hot scrape typically
 * finishes in well under five minutes; an archive run can take longer but the
 * workflow itself is durable, so a missed start within the window is safer
 * than two overlapping ingests stomping each other.
 */
const BANNER_INGEST_LEASE_MS = 30 * 60_000;

/**
 * Vercel Cron: GET with `Authorization: Bearer ${CRON_SECRET}`.
 * Query: `mode=hot` (primary term) | `mode=archive` (non-primary terms).
 * Optional: `includeLinkedArchive=1` for archive linked fetch.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const mode = request.nextUrl.searchParams.get("mode");
  if (mode !== "hot" && mode !== "archive") {
    const res = NextResponse.json(
      { error: 'Invalid or missing mode; use "hot" or "archive"' },
      { status: 400 },
    );
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const includeLinkedArchive =
    request.nextUrl.searchParams.get("includeLinkedArchive") === "1";

  const leaseKey =
    mode === "archive"
      ? `banner-ingest:archive:${includeLinkedArchive ? "linked" : "noLinked"}`
      : "banner-ingest:hot";

  const acquired = await tryAcquireCronLease(leaseKey, BANNER_INGEST_LEASE_MS);
  if (!acquired) {
    const res = NextResponse.json({
      started: false,
      mode,
      skipped: true,
      reason: "another invocation already holds the lease",
    });
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  try {
    await start(bannerIngestWorkflow, [
      {
        mode,
        includeLinkedArchive:
          mode === "archive" ? includeLinkedArchive : undefined,
      },
    ]);
  } catch (err) {
    // Releasing the lease lets the next cron tick retry instead of silently
    // skipping for the rest of the lease window. We deliberately swallow any
    // error from the release itself; logging the original failure is more
    // valuable for diagnosis.
    try {
      await releaseCronLease(leaseKey);
    } catch (releaseErr) {
      console.error(
        "banner-ingest cron: failed to release lease after start error",
        releaseErr,
      );
    }
    console.error("banner-ingest cron: workflow start failed", err);
    const res = NextResponse.json(
      {
        started: false,
        mode,
        error: "Workflow start failed; lease released for retry.",
      },
      { status: 500 },
    );
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const res = NextResponse.json({
    started: true,
    mode,
    note:
      "Workflow was scheduled; ingest runs asynchronously. Check deployment logs for completion.",
  });
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
