export type ExamReservationKind = "midterm" | "exam" | "final" | "unknown";

export type ExamReservation = {
  /** 0 = Monday … 6 = Sunday */
  days: number[];
  startMinutes: number | null;
  endMinutes: number | null;
  kind: ExamReservationKind;
  sourceText: string;
};

type ParsedExamHints = {
  reservations: ExamReservation[];
  /** True when text mentions exams but no slot could be parsed. */
  vagueExamNote: boolean;
};

const DAY_INDEX: Record<string, number> = {
  monday: 0,
  mon: 0,
  tuesday: 1,
  tue: 1,
  tues: 1,
  wednesday: 2,
  wed: 2,
  thursday: 3,
  thu: 3,
  thur: 3,
  thurs: 3,
  friday: 4,
  fri: 4,
  saturday: 5,
  sat: 5,
  sunday: 6,
  sun: 6,
};

const EXAM_WORD = /\b(exam|exams|midterm|midterms|final|finals)\b/i;

/** Parse reserved exam times from Banner section information text. */
export function parseExamReservations(
  sectionInformationText: string | null | undefined,
): ParsedExamHints {
  const raw = (sectionInformationText ?? "").trim();
  if (!raw || !EXAM_WORD.test(raw)) {
    return { reservations: [], vagueExamNote: false };
  }

  const reservations: ExamReservation[] = [];

  // Tuesday 5:10-6:50 pm reserved for midterm exams
  // CHEM1020: Wednesdays 5-7 pm are reserved for exams.
  const reservedForRe =
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)s?\b[^.]{0,80}?(\d{1,2}(?::\d{2})?)\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?[^.]{0,40}?\b(?:midterms?|finals?|exams?)/gi;
  for (const m of raw.matchAll(reservedForRe)) {
    pushReservation(
      reservations,
      m[1],
      m[2],
      m[3],
      m[4],
      m[0],
      raw,
    );
  }

  // Reserve Thursday evenings 5:10-7pm for exams
  const reserveEveningsRe =
    /\breserve\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)s?\s+evenings?\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  for (const m of raw.matchAll(reserveEveningsRe)) {
    pushReservation(reservations, m[1], m[2], m[3], "pm", m[0], raw);
  }

  // Reserve Wednesdays 5:10pm-7pm for exams (not "evenings" — handled above)
  const reserveRe =
    /\breserve\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)s?\s+(?!evenings?\s)(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  for (const m of raw.matchAll(reserveRe)) {
    pushReservation(reservations, m[1], m[2], m[3], undefined, m[0], raw);
  }

  const deduped = dedupeReservations(reservations);
  const vagueExamNote = deduped.length === 0 && EXAM_WORD.test(raw);
  return { reservations: deduped, vagueExamNote };
}

function pushReservation(
  out: ExamReservation[],
  dayRaw: string | undefined,
  startRaw: string | undefined,
  endRaw: string | undefined,
  defaultAmpm: string | undefined,
  sourceText: string,
  fullText: string,
) {
  const day = dayRaw?.toLowerCase();
  if (!day) return;
  const dayIndex = DAY_INDEX[day];
  if (dayIndex == null) return;

  const startMinutes = parseClockToken(startRaw, defaultAmpm);
  const endMinutes = parseClockToken(endRaw, defaultAmpm ?? startRaw?.match(/pm|am/i)?.[0]);
  if (startMinutes == null && endMinutes == null) return;

  out.push({
    days: [dayIndex],
    startMinutes,
    endMinutes,
    kind: classifyExamKind(fullText),
    sourceText: sourceText.trim(),
  });
}

function classifyExamKind(text: string): ExamReservationKind {
  if (/\bmidterm/i.test(text)) return "midterm";
  if (/\bfinal/i.test(text)) return "final";
  if (/\bexam/i.test(text)) return "exam";
  return "unknown";
}

function parseClockToken(
  token: string | undefined,
  defaultAmpm?: string | null,
): number | null {
  if (!token) return null;
  const t = token.trim().toLowerCase();
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hour = Number.parseInt(m[1] ?? "0", 10);
  const minute = Number.parseInt(m[2] ?? "0", 10);
  const ampm = (m[3] ?? defaultAmpm ?? "").toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (!ampm && hour <= 7) hour += 12;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function dedupeReservations(list: ExamReservation[]): ExamReservation[] {
  const seen = new Set<string>();
  const out: ExamReservation[] = [];
  for (const r of list) {
    const key = [
      r.days.join(","),
      r.startMinutes,
      r.endMinutes,
      r.kind,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Short label on calendar blocks (signals inference, not Banner data). */
export function likelyExamShortLabel(kind: ExamReservationKind): string {
  switch (kind) {
    case "midterm":
      return "Likely Midterm";
    case "final":
      return "Likely Final";
    case "exam":
      return "Likely Exam";
    default:
      return "Likely Exam";
  }
}

/** Tooltip and detail copy — explains the guess is from catalog prose. */
export const LIKELY_EXAM_DISCLOSURE =
  "Likely exam time based on course description";

/** Tooltip when inferred from MWF/TR + extra-long odd meeting pattern. */
export const LIKELY_EXAM_PATTERN_DISCLOSURE =
  "Likely exam time based on an extra-long meeting outside the regular MWF/TR schedule";

/** Section detail card when we parsed a reserved slot from section information text. */
export const LIKELY_EXAM_SECTION_INFO_NOTE =
  "Likely exam time based on course description (from section information text)";

