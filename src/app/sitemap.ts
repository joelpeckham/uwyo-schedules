import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { createDb } from "@/db/index";
import { getLatestTermCode, listTerms } from "@/lib/planner/data";
import { SEO_SITEMAP_TAG } from "@/lib/seo/cache-tags";
import { SITE_URL } from "@/lib/seo/site";
import {
  listAllDistinctCourseKeys,
  listInstructorsForSeo,
  listSubjectsForTerm,
  subjectToPathSegment,
} from "@/lib/seo/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The whole sitemap is read-only over Postgres, so cache it under the
  // shared sitemap tag. Banner ingest invalidates the tag on every scrape so
  // the next request rebuilds the entry list.
  "use cache";
  cacheTag(SEO_SITEMAP_TAG);
  cacheLife("hours");

  const db = createDb();
  const base = SITE_URL;
  const now = new Date();
  // Run independent reads in parallel so the sitemap response is bounded by
  // the slowest query rather than the sum of every roundtrip.
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
  ];

  // Fetch every term's subjects in parallel — `listTerms` already returned
  // `lastHotScrapeAt` / `lastFullScrapeAt`, so no per-term lookup is needed.
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

  const courseKeys = await listAllDistinctCourseKeys(db);
  const courseEntries: MetadataRoute.Sitemap = courseKeys.map((c) => ({
    url: `${base}/courses/${encodeURIComponent(subjectToPathSegment(c.subject))}/${encodeURIComponent(c.courseNumber.toLowerCase())}`,
    lastModified: c.lastMod ?? now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const subjectSet = new Set<string>();
  if (latest) {
    const subs = await listSubjectsForTerm(db, latest);
    for (const s of subs) {
      subjectSet.add(s.subject);
    }
  }
  const subjectEntries: MetadataRoute.Sitemap = [...subjectSet].map((subj) => ({
    url: `${base}/courses/${encodeURIComponent(subjectToPathSegment(subj))}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

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
    ...courseEntries,
    ...instructorEntries,
  ];
}
