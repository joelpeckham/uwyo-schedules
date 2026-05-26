import { listSitemapChunkIds } from "@/lib/seo/sitemap-chunks";
import { SITE_URL } from "@/lib/seo/site";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Sitemap index XML; exposed at `/sitemap.xml` via `next.config` rewrite. */
export async function GET(): Promise<Response> {
  const ids = await listSitemapChunkIds();
  const entries = ids
    .map(
      (id) =>
        `  <sitemap>\n    <loc>${escapeXml(`${SITE_URL}/sitemap/${id}.xml`)}</loc>\n  </sitemap>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
