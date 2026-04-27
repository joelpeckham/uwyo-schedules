import { decode } from "he";

/** Decode HTML entities in Banner/API strings for display and storage. */
export function decodeHtmlEntities(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  return decode(input);
}
