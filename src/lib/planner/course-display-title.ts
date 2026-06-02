import type { ClientCatalogSection } from "./client/catalog-types";
import { stripSectionSuffixFromCourseTitle } from "@/lib/catalog/strip-section-suffix-from-course-title";

function trimmedTitle(title: string | null | undefined): string | null {
  const t = title?.trim();
  if (!t) return null;
  return stripSectionSuffixFromCourseTitle(t);
}

function isLabRepeatBoilerplate(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("laboratory") && lower.includes("repeat");
}

/**
 * Client-side mirror of `canonicalAggregateCourseTitle()` — pick the lecture
 * catalog title for a course, avoiding lab-repeat boilerplate when possible.
 */
export function courseDisplayTitle(
  sections: ClientCatalogSection[],
  subject: string,
  courseNumber: string,
): string | null {
  const rows = sections.filter(
    (s) => s.subject === subject && s.courseNumber === courseNumber,
  );
  if (rows.length === 0) return null;

  for (const row of rows) {
    const type = row.scheduleTypeDescription?.toLowerCase() ?? "";
    if (type.includes("lecture")) {
      const title = trimmedTitle(row.courseTitle);
      if (title) return title;
    }
  }

  for (const row of rows) {
    const title = trimmedTitle(row.courseTitle);
    if (title && !isLabRepeatBoilerplate(title)) return title;
  }

  for (const row of rows) {
    const title = trimmedTitle(row.courseTitle);
    if (title) return title;
  }

  return null;
}
