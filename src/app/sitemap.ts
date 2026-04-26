import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/index";
import * as schema from "@/db/schema";
import { getLatestTermCode, listTerms } from "@/lib/planner/data";
import { SITE_URL } from "@/lib/seo/site";
import {
  listAllDistinctCourseKeys,
  listInstructorsForSeo,
  listSubjectsForTerm,
  subjectToPathSegment,
} from "@/lib/seo/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createDb();
  const base = SITE_URL;
  const now = new Date();
  const terms = await listTerms(db);
  const latest = await getLatestTermCode(db);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
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

  const termEntries: MetadataRoute.Sitemap = [];
  for (const t of terms) {
    const [termMod] = await db
      .select({
        lastHotScrapeAt: schema.terms.lastHotScrapeAt,
        lastFullScrapeAt: schema.terms.lastFullScrapeAt,
      })
      .from(schema.terms)
      .where(eq(schema.terms.code, t.code))
      .limit(1);
    const lastMod =
      termMod?.lastHotScrapeAt ?? termMod?.lastFullScrapeAt ?? now;

    termEntries.push({
      url: `${base}/terms/${encodeURIComponent(t.code)}`,
      lastModified: lastMod,
      changeFrequency: "daily",
      priority: t.code === latest ? 0.95 : 0.75,
    });

    const subjects = await listSubjectsForTerm(db, t.code);
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
