import { getRun } from "workflow/api";
import { NextResponse } from "next/server";

function assertAuthorized(request: Request) {
  const secret = process.env.SCRAPE_TRIGGER_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "SCRAPE_TRIGGER_SECRET is not configured" },
        { status: 500 }
      );
    }
    return null;
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ runId: string }> }
) {
  const unauthorized = assertAuthorized(request);
  if (unauthorized) return unauthorized;

  const { runId } = await ctx.params;
  try {
    const run = getRun(runId);
    const status = await run.status;
    const exists = await run.exists;
    const createdAt = await run.createdAt;
    return NextResponse.json({
      runId,
      exists,
      status,
      workflowName: await run.workflowName.catch(() => undefined),
      createdAt: createdAt.toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
