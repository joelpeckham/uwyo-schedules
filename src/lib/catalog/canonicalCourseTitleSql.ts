import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";

/**
 * Aggregate expression for one course’s display title over grouped `sections` rows.
 * Avoids `max(course_title)` on text (lexicographic), which favors Banner lab boilerplate
 * like “Laboratory - Repeat Lecture” over the lecture catalog title.
 */
export function canonicalAggregateCourseTitle() {
  return sql<string>`
    coalesce(
      max(${schema.sections.courseTitle}) filter (
        where ${schema.sections.scheduleTypeDescription} ilike '%lecture%'
      ),
      max(${schema.sections.courseTitle}) filter (
        where not (
          lower(coalesce(${schema.sections.courseTitle}, '')) like '%laboratory%'
          and lower(coalesce(${schema.sections.courseTitle}, '')) like '%repeat%'
        )
      ),
      max(${schema.sections.courseTitle})
    )
  `;
}
