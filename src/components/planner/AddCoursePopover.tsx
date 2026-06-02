"use client";

import {
  prefetchCourseSolvePackAction,
  searchCoursesAction,
} from "@/app/planner/actions";
import { addCourseLocal } from "@/lib/planner/add-course-local";
import { DUPLICATE_COURSE_ERROR, plannerHasCourse } from "@/lib/planner/local-state";
import { track } from "@/lib/analytics/track";
import type { CourseSearchRow } from "@/lib/planner/data";
import {
  courseSolvePackCourseKey,
} from "@/lib/planner/solve-schedules-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Loader2, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { usePlannerData, usePlannerHistory, usePlannerSolve } from "./PlannerContext";

type Props = {
  termCode: string;
  trigger?: ReactNode;
};

export function AddCoursePopover({ termCode, trigger }: Props) {
  const {
    plannerItems,
    setPlannerItems,
    solvePacks,
    mergeSolvePack,
  } = usePlannerData();
  const { recalculateSolutions } = usePlannerSolve();
  const { recordHistorySnapshot } = usePlannerHistory();

  const [pending, startTransition] = useTransition();
  const [searchQ, setSearchQ] = useState("");
  const [searchFetching, setSearchFetching] = useState(false);
  const [hits, setHits] = useState<CourseSearchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<CourseSearchRow | null>(null);
  const [prefetchPackPending, setPrefetchPackPending] = useState(false);
  const [prefetchPackError, setPrefetchPackError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);

  const searchSeqRef = useRef(0);
  const autoAddAfterPrefetchRef = useRef(false);

  const resetAddPopover = useCallback(() => {
    setSearchQ("");
    setHits([]);
    setPicked(null);
    setSearchActiveIndex(-1);
    setError(null);
    setPrefetchPackError(null);
    autoAddAfterPrefetchRef.current = false;
    searchSeqRef.current += 1;
    setSearchFetching(false);
  }, []);

  const onAddOpenChange = useCallback(
    (open: boolean) => {
      setAddOpen(open);
      if (!open) resetAddPopover();
    },
    [resetAddPopover],
  );

  const runSearch = useCallback(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setHits([]);
      setSearchActiveIndex(-1);
      setSearchFetching(false);
      return;
    }
    const seq = ++searchSeqRef.current;
    setSearchFetching(true);
    void (async () => {
      try {
        const rows = await searchCoursesAction(termCode, q);
        if (seq !== searchSeqRef.current) return;
        startTransition(() => {
          setHits(rows);
          setSearchActiveIndex(rows.length > 0 ? 0 : -1);
          setSearchFetching(false);
        });
      } catch {
        if (seq !== searchSeqRef.current) return;
        startTransition(() => setSearchFetching(false));
      }
    })();
  }, [searchQ, termCode]);

  useEffect(() => {
    const t = setTimeout(runSearch, 200);
    return () => clearTimeout(t);
  }, [runSearch]);

  useEffect(() => {
    if (!picked) {
      queueMicrotask(() => {
        setPrefetchPackPending(false);
        setPrefetchPackError(null);
      });
      return;
    }
    queueMicrotask(() => {
      setPrefetchPackPending(true);
      setPrefetchPackError(null);
    });
    let cancelled = false;
    void (async () => {
      const res = await prefetchCourseSolvePackAction(
        termCode,
        picked.subject,
        picked.courseNumber,
      );
      if (cancelled) return;
      setPrefetchPackPending(false);
      if (!res.ok) {
        setPrefetchPackError(res.error);
        return;
      }
      mergeSolvePack(res.pack);
    })();
    return () => {
      cancelled = true;
    };
  }, [picked, termCode, mergeSolvePack]);

  const pickedPackKey = picked
    ? courseSolvePackCourseKey(picked.subject, picked.courseNumber)
    : "";
  const hasPackForPicked = Boolean(picked && solvePacks[pickedPackKey]);

  const runAddCourse = useCallback(
    async (row: CourseSearchRow) => {
      setError(null);
      if (plannerHasCourse(plannerItems, row.subject, row.courseNumber)) {
        setError(DUPLICATE_COURSE_ERROR);
        return;
      }
      recordHistorySnapshot();
      const res = addCourseLocal({
        termCode,
        subject: row.subject,
        courseNumber: row.courseNumber,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPlannerItems(res.items);
      track("planner_course_added", {
        subject: row.subject,
        courseNumber: row.courseNumber,
        courseCount: res.items.length,
      });
      await recalculateSolutions();
      setPicked(null);
      setHits([]);
      setSearchQ("");
      setSearchActiveIndex(-1);
      setAddOpen(false);
    },
    [
      termCode,
      plannerItems,
      setPlannerItems,
      recalculateSolutions,
      recordHistorySnapshot,
    ],
  );

  const onPickCourseFromSearch = useCallback(
    (h: CourseSearchRow) => {
      setError(null);
      if (plannerHasCourse(plannerItems, h.subject, h.courseNumber)) {
        setError(DUPLICATE_COURSE_ERROR);
        return;
      }
      setSearchActiveIndex(-1);
      searchSeqRef.current += 1;
      setHits([]);
      const key = courseSolvePackCourseKey(h.subject, h.courseNumber);
      if (solvePacks[key]) {
        startTransition(() => void runAddCourse(h));
        return;
      }
      setPicked(h);
      setSearchQ("");
      autoAddAfterPrefetchRef.current = true;
    },
    [plannerItems, solvePacks, runAddCourse],
  );

  useEffect(() => {
    if (!autoAddAfterPrefetchRef.current || !picked) return;
    if (prefetchPackPending) return;
    if (prefetchPackError) {
      autoAddAfterPrefetchRef.current = false;
      return;
    }
    if (!hasPackForPicked) return;
    autoAddAfterPrefetchRef.current = false;
    startTransition(() => void runAddCourse(picked));
  }, [
    picked,
    prefetchPackPending,
    prefetchPackError,
    hasPackForPicked,
    runAddCourse,
  ]);

  const searchQueryLen = searchQ.trim().length;
  const onSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (hits.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSearchActiveIndex((i) => Math.min(hits.length - 1, Math.max(0, i + 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSearchActiveIndex((prev) => (prev <= 0 ? 0 : prev - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setSearchActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setSearchActiveIndex(hits.length - 1);
      } else if (e.key === "Enter" && searchActiveIndex >= 0) {
        e.preventDefault();
        const row = hits[searchActiveIndex];
        if (row) onPickCourseFromSearch(row);
      }
    },
    [hits, onPickCourseFromSearch, searchActiveIndex],
  );

  const defaultTrigger = (
    <Button
      type="button"
      variant="default"
      size="lg"
      className="touch-manipulation h-10 min-h-10 rounded-md px-3"
    >
      <Plus className="size-4" />
      <span className="ml-2">Add course</span>
    </Button>
  );

  return (
    <Popover open={addOpen} onOpenChange={onAddOpenChange}>
      <PopoverTrigger asChild>{trigger ?? defaultTrigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] px-3 pt-3 pb-2"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label htmlFor="course-search-toolbar" className="shrink-0 text-muted-foreground">
            Search courses
          </Label>
          <div
            className="flex h-4 min-w-0 flex-1 items-center justify-end overflow-hidden text-xs"
            aria-live="polite"
          >
            {error ? (
              <p className="truncate text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {searchQueryLen > 0 && searchQueryLen < 2 ? (
              <p className="truncate text-muted-foreground">
                Type at least 2 characters to search.
              </p>
            ) : null}
            {searchQueryLen >= 2 && searchFetching ? (
              <p
                className="flex max-w-full items-center justify-end gap-1.5 truncate text-muted-foreground"
                role="status"
              >
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Searching&hellip;
              </p>
            ) : null}
            {searchQueryLen >= 2 && !searchFetching && !pending && hits.length === 0 ? (
              <p className="truncate text-muted-foreground" role="status">
                No courses match that search.
              </p>
            ) : null}
            {picked && prefetchPackPending ? (
              <p
                className="flex max-w-full items-center justify-end gap-1.5 truncate text-muted-foreground"
                role="status"
              >
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Loading sections&hellip;
              </p>
            ) : null}
            {pending ? (
              <p
                className="flex max-w-full items-center justify-end gap-1.5 truncate text-muted-foreground"
                role="status"
              >
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Adding course&hellip;
              </p>
            ) : null}
            {picked && prefetchPackError ? (
              <p className="truncate text-destructive" role="alert">
                {prefetchPackError}
              </p>
            ) : null}
          </div>
        </div>
        <Input
          id="course-search-toolbar"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="course-search-toolbar-listbox"
          aria-activedescendant={
            searchActiveIndex >= 0
              ? `course-search-toolbar-hit-${searchActiveIndex}`
              : undefined
          }
          aria-autocomplete="list"
          value={searchQ}
          onChange={(e) => {
            setSearchQ(e.target.value);
            setSearchActiveIndex(-1);
          }}
          onKeyDown={onSearchKeyDown}
          placeholder="Subject or number"
          className="min-h-11"
          autoComplete="off"
        />
        {hits.length > 0 ? (
          <ul
            id="course-search-toolbar-listbox"
            className="mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-sm"
            role="listbox"
            aria-label="Course search results"
          >
            {hits.map((h, idx) => (
              <li key={`${h.subject}-${h.courseNumber}`} role="none">
                <button
                  type="button"
                  id={`course-search-toolbar-hit-${idx}`}
                  role="option"
                  aria-selected={searchActiveIndex === idx}
                  disabled={pending || prefetchPackPending}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-50",
                    picked?.subject === h.subject &&
                      picked?.courseNumber === h.courseNumber &&
                      "bg-muted",
                    searchActiveIndex === idx &&
                      "bg-muted/80 ring-1 ring-ring/60",
                  )}
                  onClick={() => onPickCourseFromSearch(h)}
                  onMouseEnter={() => setSearchActiveIndex(idx)}
                >
                  <span className="font-mono text-foreground">
                    {h.subjectCourse ?? `${h.subject} ${h.courseNumber}`}
                  </span>
                  {h.previewTitle ? (
                    <span className="text-muted-foreground">{h.previewTitle}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
