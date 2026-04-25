import { start } from "workflow/api";
import { NextResponse } from "next/server";
import { scrapeUwyoCatalogWorkflow } from "@/workflows/scrape-uwyo-catalog";
import type { ScrapeCatalogInput } from "@/workflows/scrape-uwyo-catalog";

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

export async function POST(request: Request) {
  const unauthorized = assertAuthorized(request);
  if (unauthorized) return unauthorized;

  let body: ScrapeCatalogInput = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as ScrapeCatalogInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const run = await start(scrapeUwyoCatalogWorkflow, [body]);
  return NextResponse.json({
    runId: run.runId,
    message: "UWYO catalog scrape workflow started",
  });
}
