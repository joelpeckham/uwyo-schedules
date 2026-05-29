/** Structurally compatible with `TimeInterval` in solve-schedules-core. */
type BitmaskInterval = {
  dayIndex: number;
  start: number;
  end: number;
};

/** Per-day sorted unique minute boundaries (includes 0 and 1440 sentinels when needed). */
type BitmaskBasis = {
  dayBoundaries: number[][];
  /** Words per day bitset (ceil(slots / 32)). */
  wordsPerDay: number;
  totalWords: number;
};

function intervalSortCmp(a: BitmaskInterval, b: BitmaskInterval): number {
  if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
  return a.start - b.start;
}

function sortedHasInternalOverlap(intervals: BitmaskInterval[]): boolean {
  for (let i = 1; i < intervals.length; i++) {
    const prev = intervals[i - 1]!;
    const curr = intervals[i]!;
    if (prev.dayIndex === curr.dayIndex && curr.start < prev.end) return true;
  }
  return false;
}

function sortedAnyOverlap(a: BitmaskInterval[], b: BitmaskInterval[]): boolean {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ai = a[i]!;
    const bj = b[j]!;
    if (ai.dayIndex < bj.dayIndex) {
      i++;
      continue;
    }
    if (ai.dayIndex > bj.dayIndex) {
      j++;
      continue;
    }
    if (ai.start < bj.end && bj.start < ai.end) return true;
    if (ai.end <= bj.end) i++;
    else j++;
  }
  return false;
}

/** Collect intervals from candidates and optional blackout list. */
export function flattenIntervalsForBasis(
  meetingsByCrn: Map<string, BitmaskInterval[]>,
  candidates: readonly { crns: string[] }[],
  blackoutIntervals: BitmaskInterval[],
): BitmaskInterval[] {
  const flat: BitmaskInterval[] = [];
  for (const cand of candidates) {
    for (const crn of cand.crns) {
      const ivs = meetingsByCrn.get(crn);
      if (!ivs) continue;
      for (const iv of ivs) flat.push(iv);
    }
  }
  for (const iv of blackoutIntervals) flat.push(iv);
  return flat;
}

export function buildBitmaskBasis(allIntervals: BitmaskInterval[]): BitmaskBasis {
  const dayBoundaries: number[][] = Array.from({ length: 7 }, () => []);
  for (const iv of allIntervals) {
    if (iv.dayIndex < 0 || iv.dayIndex > 6) continue;
    const arr = dayBoundaries[iv.dayIndex]!;
    arr.push(iv.start, iv.end);
  }
  let maxSlots = 0;
  for (let d = 0; d < 7; d++) {
    const raw = dayBoundaries[d]!;
    const uniq = [...new Set(raw)].sort((a, b) => a - b);
    dayBoundaries[d] = uniq;
    if (uniq.length > 1) maxSlots = Math.max(maxSlots, uniq.length - 1);
  }
  const wordsPerDay = maxSlots === 0 ? 0 : Math.ceil(maxSlots / 32);
  return {
    dayBoundaries,
    wordsPerDay,
    totalWords: wordsPerDay * 7,
  };
}

function markIntervalOnDay(
  mask: Uint32Array,
  dayIndex: number,
  start: number,
  end: number,
  basis: BitmaskBasis,
): void {
  const bounds = basis.dayBoundaries[dayIndex];
  if (!bounds || bounds.length < 2 || basis.wordsPerDay === 0) return;
  const baseWord = dayIndex * basis.wordsPerDay;
  for (let i = 0; i < bounds.length - 1; i++) {
    const slotStart = bounds[i]!;
    const slotEnd = bounds[i + 1]!;
    if (start < slotEnd && slotStart < end) {
      const w = baseWord + (i >> 5);
      mask[w] = (mask[w] ?? 0) | (1 << (i & 31));
    }
  }
}

export function intervalsToMask(
  intervals: BitmaskInterval[],
  basis: BitmaskBasis,
): Uint32Array {
  const mask = new Uint32Array(basis.totalWords);
  for (const iv of intervals) {
    if (iv.dayIndex < 0 || iv.dayIndex > 6) continue;
    markIntervalOnDay(mask, iv.dayIndex, iv.start, iv.end, basis);
  }
  return mask;
}

export function masksConflict(a: Uint32Array, b: Uint32Array): boolean {
  for (let i = 0; i < a.length; i++) {
    if ((a[i]! & b[i]!) !== 0) return true;
  }
  return false;
}

export function maskOrInto(acc: Uint32Array, add: Uint32Array): void {
  for (let i = 0; i < acc.length; i++) {
    acc[i] = (acc[i] ?? 0) | (add[i] ?? 0);
  }
}

export function maskXorInto(acc: Uint32Array, remove: Uint32Array): void {
  for (let i = 0; i < acc.length; i++) {
    acc[i] = (acc[i] ?? 0) ^ (remove[i] ?? 0);
  }
}

function candidateMeetingIntervals(
  cand: { crns: string[] },
  meetingsByCrn: Map<string, BitmaskInterval[]>,
): BitmaskInterval[] {
  const flat: BitmaskInterval[] = [];
  for (const crn of cand.crns) {
    const ivs = meetingsByCrn.get(crn);
    if (!ivs) continue;
    for (const iv of ivs) flat.push(iv);
  }
  flat.sort(intervalSortCmp);
  return flat;
}

/** Self-overlap and blackout rejection; returns sorted flat intervals or null. */
export function validCandidateIntervals(
  cand: { crns: string[] },
  meetingsByCrn: Map<string, BitmaskInterval[]>,
  blackoutIntervals: BitmaskInterval[],
): BitmaskInterval[] | null {
  const flat = candidateMeetingIntervals(cand, meetingsByCrn);
  if (sortedHasInternalOverlap(flat)) return null;
  if (
    blackoutIntervals.length > 0 &&
    sortedAnyOverlap(flat, blackoutIntervals)
  ) {
    return null;
  }
  return flat;
}

export type PreparedCandidate<T> = {
  cand: T;
  mask: Uint32Array;
};
