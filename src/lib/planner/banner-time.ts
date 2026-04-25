/**
 * Banner SSB meeting times are typically 4-digit strings, e.g. `1510` → 15:10.
 */
export function parseBannerClock(
  value: string | null | undefined,
): { hour: number; minute: number } | null {
  if (value == null || value === "") return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 3) return null;
  const padded =
    digits.length >= 4 ? digits.slice(0, 4) : digits.padStart(4, "0");
  const hour = Number.parseInt(padded.slice(0, 2), 10);
  const minute = Number.parseInt(padded.slice(2, 4), 10);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  return { hour, minute };
}

/** Minutes from midnight (0–1439). */
export function bannerClockToMinutes(
  value: string | null | undefined,
): number | null {
  const t = parseBannerClock(value);
  if (!t) return null;
  return t.hour * 60 + t.minute;
}

/** Fractional hour for layout, e.g. 9.5 = 9:30. */
export function minutesToDecimalHour(minutes: number): number {
  return minutes / 60;
}
