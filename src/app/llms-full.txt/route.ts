import { SITE_URL } from "@/lib/seo/site";
import {
  buildLlmsFullTxt,
  instructorPagesEnabledFromEnv,
} from "@/lib/seo/llms-txt";

export function GET() {
  // The body is fully synchronous; the response-level `Cache-Control` keeps
  // CDN/browser caching hot. Cache Components forbids the `revalidate`
  // segment config and we don't read any data, so we don't need
  // `'use cache'` here either.
  const body = buildLlmsFullTxt(SITE_URL, {
    includeInstructorPages: instructorPagesEnabledFromEnv(),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
