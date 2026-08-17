import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { createDb } from "@/db/index";
import { getLatestTermCode, listTerms } from "@/lib/planner/data";
import { SEO_SITEMAP_TAG } from "@/lib/seo/cache-tags";
import { SITE_URL } from "@/lib/seo/site";
import { COURSE_CHUNK_SIZE, listSitemapChunkIds } from "@/lib/seo/sitemap-chunks";
import {
  listDistinctCourseKeysPage,
  listInstructorsForSeo,
  listSubjectsForTerm,
  subjectToPathSegment,
} from "@/lib/seo/queries";

/**
 * Chunked sitemaps at `/sitemap/[id].xml`. The index at `/sitemap.xml` is
 * rewritten to `/sitemap-index` (Next 16.2 does not emit the index in prod).
 *
 * Chunk 0 holds static + term + subject + instructor entries; further chunks
 * hold course URLs in pages of `COURSE_CHUNK_SIZE`.
 */
export async function generateSitemaps(): Promise<{ id: number }[]> {
  const ids = await listSitemapChunkIds();
  return ids.map((id) => ({ id }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheTag(SEO_SITEMAP_TAG);
  cacheLife("hours");

  const idStr = await props.id;
  const id = Number.parseInt(idStr, 10);

  const db = createDb();
  const base = SITE_URL;
  const now = new Date();

  if (!Number.isFinite(id) || id <= 0) {
    const [terms, latest] = await Promise.all([
      listTerms(db),
      getLatestTermCode(db),
    ]);

    const staticEntries: MetadataRoute.Sitemap = [
      {
        url: base,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 1,
      },
      {
        url: `${base}/planner`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.95,
      },
      {
        url: `${base}/about`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        url: `${base}/faq`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        url: `${base}/courses`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.9,
      },
      {
        url: `${base}/terms`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.9,
      },
      {
        url: `${base}/llms.txt`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.3,
      },
      {
        url: `${base}/llms-full.txt`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.2,
      },
    ];

    const subjectsByTerm = await Promise.all(
      terms.map((t) =>
        listSubjectsForTerm(db, t.code).then((subjects) => ({
          term: t,
          subjects,
        })),
      ),
    );

    const termEntries: MetadataRoute.Sitemap = [];
    for (const { term: t, subjects } of subjectsByTerm) {
      const lastMod = t.lastHotScrapeAt ?? t.lastFullScrapeAt ?? now;
      termEntries.push({
        url: `${base}/terms/${encodeURIComponent(t.code)}`,
        lastModified: lastMod,
        changeFrequency: "daily",
        priority: t.code === latest ? 0.95 : 0.75,
      });
      for (const s of subjects) {
        termEntries.push({
          url: `${base}/terms/${encodeURIComponent(t.code)}/${encodeURIComponent(subjectToPathSegment(s.subject))}`,
          lastModified: lastMod,
          changeFrequency: "weekly",
          priority: 0.55,
        });
      }
    }

    const subjectSet = new Set<string>();
    if (latest) {
      const subs = await listSubjectsForTerm(db, latest);
      for (const s of subs) subjectSet.add(s.subject);
    }
    const subjectEntries: MetadataRoute.Sitemap = [...subjectSet].map(
      (subj) => ({
        url: `${base}/courses/${encodeURIComponent(subjectToPathSegment(subj))}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      }),
    );

    const enableInstructors =
      process.env.SEO_INSTRUCTOR_PAGES === "1" ||
      process.env.SEO_INSTRUCTOR_PAGES === "true";
    let instructorEntries: MetadataRoute.Sitemap = [];
    if (enableInstructors) {
      const inst = await listInstructorsForSeo(db, 3);
      instructorEntries = inst.map((i) => ({
        url: `${base}/instructors/${encodeURIComponent(i.slug)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.4,
      }));
    }

    return [
      ...staticEntries,
      ...subjectEntries,
      ...termEntries,
      ...instructorEntries,
    ];
  }

  const offset = (id - 1) * COURSE_CHUNK_SIZE;
  const courseKeys = await listDistinctCourseKeysPage(db, {
    limit: COURSE_CHUNK_SIZE,
    offset,
  });
  return courseKeys.map((c) => ({
    url: `${base}/courses/${encodeURIComponent(subjectToPathSegment(c.subject))}/${encodeURIComponent(c.courseNumber.toLowerCase())}`,
    lastModified: c.lastMod ?? now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));
}
