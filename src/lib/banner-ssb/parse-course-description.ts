import { decodeHtmlEntities } from "@/lib/text/decodeHtmlEntities";

export type ParsedCourseDescription = {
  courseDescription: string | null;
  sectionInformationText: string | null;
};

/** Strip tags and collapse whitespace from a Banner HTML fragment. */
function stripHtmlFragment(html: string): string {
  const noTags = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const decoded = decodeHtmlEntities(noTags) ?? noTags;
  return decoded.trim();
}

/**
 * Parse HTML from `GET .../searchResults/getCourseDescription`.
 * Returns course catalog prose and optional per-section information text.
 */
export function parseCourseDescriptionHtml(
  html: string,
): ParsedCourseDescription {
  const sectionLabel = /<b>\s*Section information text:\s*<\/b>/i;
  const sectionMatch = html.match(sectionLabel);
  if (!sectionMatch || sectionMatch.index == null) {
    const courseOnly = extractCourseDescriptionOnly(html);
    return { courseDescription: courseOnly, sectionInformationText: null };
  }

  const beforeSection = html.slice(0, sectionMatch.index);
  const afterSection = html.slice(sectionMatch.index + sectionMatch[0].length);

  const courseDescription = extractCourseDescriptionOnly(beforeSection);

  const sectionEnd = afterSection.search(
    /<!--\s*when there is no course or section description/i,
  );
  const sectionRaw =
    sectionEnd >= 0 ? afterSection.slice(0, sectionEnd) : afterSection;
  const sectionInformationText =
    stripHtmlFragment(sectionRaw.replace(/^<br\s*\/?>/i, "")) || null;

  return { courseDescription, sectionInformationText };
}

function extractCourseDescriptionOnly(html: string): string | null {
  const commentEnd = html.indexOf("<!--if there is a section description");
  const slice =
    commentEnd >= 0 ? html.slice(0, commentEnd) : html;
  const displayStart = slice.indexOf("<!--display course description-->");
  const body =
    displayStart >= 0
      ? slice.slice(displayStart + "<!--display course description-->".length)
      : slice;
  const text = stripHtmlFragment(body);
  return text.length > 0 ? text : null;
}
