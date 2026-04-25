/**
 * Escape `%`, `_`, and `\` for use inside a SQL `ILIKE` pattern so user input
 * is matched literally for those characters.
 */
export function escapeIlikePattern(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}
