import { SITE_URL } from "@/lib/seo/site";
import {
  buildLlmsFullTxt,
  instructorPagesEnabledFromEnv,
} from "@/lib/seo/llms-txt";

export const revalidate = 3600;

export function GET() {
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
