import { NextResponse } from "next/server";
import { readCatalogBlobRawStream } from "@/lib/banner-ssb/steps/blob";

/**
 * Allows the browser to download gzipped term catalogs from a private Blob store
 * without embedding `BLOB_READ_WRITE_TOKEN` in the client.
 */
function isAllowedTermCatalogPathname(pathname: string): boolean {
  if (pathname.includes("..")) return false;
  if (!pathname.startsWith("catalog-runs/")) return false;
  if (!pathname.endsWith("/catalog.json.gz")) return false;
  const segments = pathname.split("/").filter(Boolean);
  return (
    segments.length === 4 &&
    segments[0] === "catalog-runs" &&
    segments[3] === "catalog.json.gz"
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathname = url.searchParams.get("pathname");
  if (!pathname) {
    return NextResponse.json({ error: "Missing pathname" }, { status: 400 });
  }
  if (!isAllowedTermCatalogPathname(pathname)) {
    return NextResponse.json({ error: "Invalid pathname" }, { status: 400 });
  }

  try {
    const stream = await readCatalogBlobRawStream(pathname);
    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
