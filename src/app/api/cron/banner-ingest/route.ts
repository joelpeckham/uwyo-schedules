import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { bannerIngestWorkflow } from "@/workflows/banner-ingest";

/**
 * Vercel Cron: GET with `Authorization: Bearer ${CRON_SECRET}`.
 * Query: `mode=hot` (primary term) | `mode=archive` (non-primary terms).
 * Optional: `includeLinkedArchive=1` for archive linked fetch.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get("mode");
  if (mode !== "hot" && mode !== "archive") {
    return NextResponse.json(
      { error: 'Invalid or missing mode; use "hot" or "archive"' },
      { status: 400 },
    );
  }

  const includeLinkedArchive =
    request.nextUrl.searchParams.get("includeLinkedArchive") === "1";

  await start(bannerIngestWorkflow, [
    {
      mode,
      includeLinkedArchive:
        mode === "archive" ? includeLinkedArchive : undefined,
    },
  ]);

  return NextResponse.json({ started: true, mode });
}
