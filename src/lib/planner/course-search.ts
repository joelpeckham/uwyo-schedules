import type { CourseSearchDoc, CourseSearchRow } from "./data";

const ROMAN_TO_ARABIC: Record<string, string> = {
  xii: "12",
  xi: "11",
  x: "10",
  ix: "9",
  viii: "8",
  vii: "7",
  vi: "6",
  v: "5",
  iv: "4",
  iii: "3",
  ii: "2",
  i: "1",
};

const ROMAN_TOKEN_RE =
  /\b(xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)\b/gi;

/** Lowercase alphanumeric only — `PHYS 1110` and `PHYS1110` both become `phys1110`. */
export function normalizeCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Lowercase text with Roman numerals mapped to Arabic digits for matching. */
export function normalizeText(value: string): string {
  const lowered = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const romanized = lowered.replace(ROMAN_TOKEN_RE, (m) => {
    const key = m.toLowerCase();
    return ROMAN_TO_ARABIC[key] ?? m;
  });
  return romanized.replace(/\s+/g, " ").trim();
}

function textTokens(value: string): string[] {
  const n = normalizeText(value);
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

/** Score 0–100 for how well query tokens match words in `haystack`. */
function tokenMatchScore(haystack: string, query: string): number {
  const qTokens = textTokens(query);
  if (qTokens.length === 0) return 0;
  const words = textTokens(haystack);
  if (words.length === 0) return 0;

  let matched = 0;
  let wordStartHits = 0;
  let lastWordIdx = -1;
  let contiguousBonus = 0;

  for (const qt of qTokens) {
    let bestIdx = -1;
    let bestRank = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i]!;
      let rank = 0;
      if (w === qt) rank = 4;
      else if (w.startsWith(qt)) rank = 3;
      else if (w.includes(qt)) rank = 2;
      else continue;
      if (rank > bestRank || (rank === bestRank && i > bestIdx)) {
        bestRank = rank;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return 0;
    matched++;
    if (words[bestIdx]!.startsWith(qt)) wordStartHits++;
    if (lastWordIdx >= 0 && bestIdx === lastWordIdx + 1) {
      contiguousBonus += 8;
    }
    lastWordIdx = bestIdx;
  }

  const coverage = (matched / qTokens.length) * 55;
  const starts = (wordStartHits / qTokens.length) * 25;
  return Math.min(100, Math.round(coverage + starts + contiguousBonus));
}

const SCORE = {
  crnExact: 10_000,
  codeExact: 9_000,
  codePrefix: 8_000,
  codeSubstring: 7_000,
  titleBase: 6_000,
  subjectDescBase: 4_000,
  instructorBase: 3_000,
} as const;

function docCodeKeys(doc: CourseSearchDoc): string[] {
  const keys = new Set<string>();
  keys.add(normalizeCode(`${doc.subject}${doc.courseNumber}`));
  if (doc.subjectCourse) keys.add(normalizeCode(doc.subjectCourse));
  keys.add(normalizeCode(doc.subject));
  return [...keys].filter(Boolean);
}

function scoreDoc(doc: CourseSearchDoc, rawQuery: string): number {
  const q = rawQuery.trim();
  if (!q) return 0;

  const qCode = normalizeCode(q);
  const qNorm = normalizeText(q);
  const qDigitsOnly = /^\d+$/.test(q);

  if (qDigitsOnly && doc.crns.some((c) => c === q)) {
    return SCORE.crnExact;
  }

  if (qCode.length > 0) {
    const keys = docCodeKeys(doc);
    const combined = normalizeCode(`${doc.subject}${doc.courseNumber}`);
    if (keys.some((k) => k === qCode) || combined === qCode) {
      return SCORE.codeExact;
    }
    if (
      keys.some((k) => k.startsWith(qCode)) ||
      combined.startsWith(qCode)
    ) {
      return SCORE.codePrefix + Math.min(200, qCode.length);
    }
    if (
      keys.some((k) => k.includes(qCode)) ||
      combined.includes(qCode)
    ) {
      return SCORE.codeSubstring + Math.min(100, qCode.length);
    }
  }

  const title = doc.previewTitle ?? "";
  const titleScore = tokenMatchScore(title, q);
  if (titleScore > 0) {
    return SCORE.titleBase + titleScore;
  }

  const subjectDesc = doc.subjectDescription ?? "";
  const subjectScore = tokenMatchScore(subjectDesc, q);
  if (subjectScore > 0) {
    return SCORE.subjectDescBase + subjectScore;
  }

  const instructorHaystack = doc.instructors.join(" ");
  const instructorScore = tokenMatchScore(instructorHaystack, q);
  if (instructorScore > 0) {
    return SCORE.instructorBase + instructorScore;
  }

  if (qNorm.length >= 2) {
    const subjectNorm = normalizeText(doc.subject);
    if (subjectNorm.includes(qNorm) || qNorm.includes(subjectNorm)) {
      return SCORE.subjectDescBase + 10;
    }
  }

  return 0;
}

function compareDocs(a: CourseSearchDoc, b: CourseSearchDoc): number {
  const sub = a.subject.localeCompare(b.subject);
  if (sub !== 0) return sub;
  return a.courseNumber.localeCompare(b.courseNumber, undefined, {
    numeric: true,
  });
}

function toSearchRow(doc: CourseSearchDoc): CourseSearchRow {
  return {
    termCode: doc.termCode,
    subject: doc.subject,
    courseNumber: doc.courseNumber,
    subjectCourse: doc.subjectCourse,
    previewTitle: doc.previewTitle,
  };
}

/** Rank catalog docs for a query; returns display rows best-first. */
export function rankCourses(
  docs: CourseSearchDoc[],
  query: string,
  limit = 30,
): CourseSearchRow[] {
  const q = query.trim();
  if (q.length < 1) return [];

  const scored: { doc: CourseSearchDoc; score: number }[] = [];
  for (const doc of docs) {
    const score = scoreDoc(doc, q);
    if (score > 0) scored.push({ doc, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return compareDocs(a.doc, b.doc);
  });

  return scored.slice(0, limit).map(({ doc }) => toSearchRow(doc));
}
