/** Cache / revalidation tags for SEO routes (use with `cacheTag` + `revalidateTag`). */

export function seoTermTag(termCode: string): string {
  return `seo-term:${termCode}`;
}

export function seoCourseTag(subject: string, courseNumber: string): string {
  return `seo-course:${subject.toUpperCase()}:${courseNumber}`;
}

export function seoTermSubjectTag(termCode: string, subject: string): string {
  return `seo-term-subject:${termCode}:${subject.toUpperCase()}`;
}

export const SEO_SITEMAP_TAG = "seo-sitemap";

export function seoInstructorTag(slug: string): string {
  return `seo-instructor:${slug}`;
}
