/** Banner section suffix on aggregate course titles, e.g. "Gen Chemistry I - Sec 2". */
const SECTION_SUFFIX_RE = /\s*-\s*Sec(?:tion)?\.?\s*\d+\s*$/i;

/**
 * Remove a trailing section identifier from a course title when Banner embeds
 * the section number in `courseTitle` (common for multi-section lecture courses).
 */
export function stripSectionSuffixFromCourseTitle(title: string): string {
  const stripped = title.replace(SECTION_SUFFIX_RE, "").trim();
  return stripped.length > 0 ? stripped : title.trim();
}
