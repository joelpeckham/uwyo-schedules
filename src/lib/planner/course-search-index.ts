"use client";

import { getCourseSearchIndexAction } from "@/app/planner/actions";
import type { CourseSearchDoc } from "@/lib/planner/data";

const indexCache = new Map<string, CourseSearchDoc[]>();
const indexInflight = new Map<string, Promise<CourseSearchDoc[] | null>>();

/** Cached index for a term, if already loaded this session. */
export function getCachedCourseSearchIndex(
  termCode: string,
): CourseSearchDoc[] | undefined {
  return indexCache.get(termCode);
}

/** Load (or await in-flight) the per-term course search index. */
export function loadCourseSearchIndex(
  termCode: string,
): Promise<CourseSearchDoc[] | null> {
  const cached = indexCache.get(termCode);
  if (cached) return Promise.resolve(cached);

  const inflight = indexInflight.get(termCode);
  if (inflight) return inflight;

  const promise = getCourseSearchIndexAction(termCode)
    .then((docs) => {
      indexCache.set(termCode, docs);
      return docs;
    })
    .catch(() => null)
    .finally(() => {
      indexInflight.delete(termCode);
    });

  indexInflight.set(termCode, promise);
  return promise;
}

/** Warm the search index (page load, term change). Safe to call repeatedly. */
export function prefetchCourseSearchIndex(termCode: string): void {
  if (!termCode.trim()) return;
  if (indexCache.has(termCode) || indexInflight.has(termCode)) return;
  void loadCourseSearchIndex(termCode);
}
