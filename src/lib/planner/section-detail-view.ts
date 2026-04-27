import { parseBannerClock } from "@/lib/planner/banner-time";
import { decodeHtmlEntities } from "@/lib/text/decodeHtmlEntities";

const DAY_FIELDS = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
] as const;

type ParsedSectionResult =
  | { ok: true; root: Record<string, unknown> }
  | { ok: false; message: string };

export function parseSectionRawJson(input: unknown): ParsedSectionResult {
  if (input == null) {
    return { ok: false, message: "No section data." };
  }
  if (typeof input === "string") {
    try {
      const v = JSON.parse(input) as unknown;
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        return { ok: true, root: v as Record<string, unknown> };
      }
      return { ok: false, message: "Section data was not a JSON object." };
    } catch {
      return { ok: false, message: "Could not parse section data as JSON." };
    }
  }
  if (typeof input === "object" && !Array.isArray(input)) {
    return { ok: true, root: input as Record<string, unknown> };
  }
  return { ok: false, message: "Section data was not an object." };
}

export function stringField(
  r: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = r[key];
  if (typeof v === "string" && v.trim() !== "") {
    return decodeHtmlEntities(v) ?? v;
  }
  return undefined;
}

export function numberField(
  r: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = r[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function booleanField(
  r: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const v = r[key];
  if (typeof v === "boolean") return v;
  return undefined;
}

/** Format a single Banner HHmm clock as "3:10 p.m." */
export function formatBannerTimeDisplay(
  value: string | null | undefined,
): string | null {
  const t = parseBannerClock(value);
  if (!t) return null;
  const { hour, minute } = t;
  const ap = hour >= 12 ? "p.m." : "a.m.";
  const hr = hour % 12 === 0 ? 12 : hour % 12;
  const mm = minute.toString().padStart(2, "0");
  return `${hr}:${mm} ${ap}`;
}

export function formatBannerTimeRange(
  begin: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const a = formatBannerTimeDisplay(begin);
  const b = formatBannerTimeDisplay(end);
  if (a && b) return `${a} – ${b}`;
  if (a) return a;
  if (b) return b;
  return null;
}

/**
 * Human-readable weekday list from Banner meetingTime booleans.
 */
export function formatMeetingDays(
  meetingTime: Record<string, unknown> | null | undefined,
): string | null {
  if (!meetingTime) return null;
  const labels: string[] = [];
  for (const [key, abbrev] of DAY_FIELDS) {
    if (meetingTime[key] === true) labels.push(abbrev);
  }
  if (labels.length === 0) return null;
  return labels.join(", ");
}

export function asRecordArray(
  value: unknown,
): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (x): x is Record<string, unknown> =>
      x !== null && typeof x === "object" && !Array.isArray(x),
  );
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
