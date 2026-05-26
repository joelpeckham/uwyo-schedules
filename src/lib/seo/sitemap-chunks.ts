import { cacheLife, cacheTag } from "next/cache";
import { createDb } from "@/db/index";
import { SEO_SITEMAP_TAG } from "@/lib/seo/cache-tags";
import { countDistinctCourseKeys } from "@/lib/seo/queries";

/** Google caps a sitemap file at 50,000 URLs / 50 MB; pick a comfortable chunk. */
export const COURSE_CHUNK_SIZE = 10_000;

/**
 * Chunk 0: static + term + subject + instructor URLs.
 * Chunks 1..N: course detail URLs in pages of `COURSE_CHUNK_SIZE`.
 */
export async function listSitemapChunkIds(): Promise<number[]> {
  "use cache";
  cacheTag(SEO_SITEMAP_TAG);
  cacheLife("hours");

  const db = createDb();
  const total = await countDistinctCourseKeys(db);
  const courseChunks = Math.max(1, Math.ceil(total / COURSE_CHUNK_SIZE));
  const ids = [0];
  for (let i = 1; i <= courseChunks; i++) ids.push(i);
  return ids;
}
