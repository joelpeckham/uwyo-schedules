import { SITE_URL } from "@/lib/seo/site";
import {
  buildLlmsTxt,
  instructorPagesEnabledFromEnv,
} from "@/lib/seo/llms-txt";

export function GET() {
  // The body is fully synchronous; response-level `Cache-Control` keeps
  // CDN/browser caching hot. Cache Components forbids `revalidate` segment
  // config, and we don't read any data so `'use cache'` is unnecessary.
  const body = buildLlmsTxt(SITE_URL, {
    includeInstructorPages: instructorPagesEnabledFromEnv(),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
