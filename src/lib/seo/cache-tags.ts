/** Cache / revalidation tags for SEO routes (use with `cacheTag` + `revalidateTag`). */

export function seoTermTag(termCode: string): string {
  return `seo-term:${termCode}`;
}

export function seoCourseTag(subject: string, courseNumber: string): string {
  return `seo-course:${subject.toUpperCase()}:${courseNumber}`;
}

export function seoSubjectCatalogTag(subject: string): string {
  return `seo-subject:${subject.toUpperCase()}`;
}

export function seoTermSubjectTag(termCode: string, subject: string): string {
  return `seo-term-subject:${termCode}:${subject.toUpperCase()}`;
}

export const SEO_SITEMAP_TAG = "seo-sitemap";

/** Invalidate all SEO cached reads after a Banner ingest completes. */
export const SEO_BANNER_DATA_TAG = "seo-banner-data";

export function seoInstructorTag(slug: string): string {
  return `seo-instructor:${slug}`;
}
