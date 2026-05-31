"use client";

import {
  prefetchCourseSolvePackAction,
  searchCoursesAction,
} from "@/app/planner/actions";
import {
  computePlannerCreditHours,
  formatCreditHours,
} from "@/lib/planner/credit-hours";
import { addCourseLocal } from "@/lib/planner/add-course-local";
import { DUPLICATE_COURSE_ERROR, plannerHasCourse } from "@/lib/planner/local-state";
import { track } from "@/lib/analytics/track";
import type { CourseSearchRow, PlannerItemRow } from "@/lib/planner/data";
import {
  INSTRUCTOR_SELECT_ANY,
  linkedScheduleTypeRows,
  primaryInstructorOptions,
} from "@/lib/planner/instructor-options-from-pack";
import {
  parseInstructorPrefs,
  serializeInstructorPrefs,
  type InstructorPrefsV1,
} from "@/lib/planner/instructor-prefs";
import { parseSectionPinsJson } from "@/lib/planner/section-pins";
import {
  courseSolvePackCourseKey,
  type CourseSolvePack,
} from "@/lib/planner/solve-schedules-core";
import { PlannerCourseColorPicker } from "@/components/planner/PlannerCourseColorPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { CourseSectionPicker } from "./CourseSectionPicker";
import { usePlannerData, usePlannerHistory, usePlannerSolve } from "./PlannerContext";

type ColorCellProps = {
  itemId: number;
  displayColor: string;
  disabled: boolean;
  onPickById: (id: number, hex: string) => void;
};

const CourseRowColorCell = memo(function CourseRowColorCell({
  itemId,
  displayColor,
  disabled,
  onPickById,
}: ColorCellProps) {
  const onPick = useCallback(
    (hex: string) => onPickById(itemId, hex),
    [itemId, onPickById],
  );
  return (
    <PlannerCourseColorPicker
      displayColor={displayColor}
      disabled={disabled}
      onPick={onPick}
    />
  );
});

type RemoveButtonProps = {
  itemId: number;
  ariaLabel: string;
  disabled: boolean;
  onRemoveById: (id: number) => void;
};

const CourseRowRemoveButton = memo(function CourseRowRemoveButton({
  itemId,
  ariaLabel,
  disabled,
  onRemoveById,
}: RemoveButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-destructive hover:text-destructive"
      disabled={disabled}
      onClick={() => onRemoveById(itemId)}
      aria-label={ariaLabel}
    >
      <Trash2 className="size-4" />
    </Button>
  );
});

type Props = { termCode: string };

function primarySelectValue(p: InstructorPrefsV1): string {
  const n = p.primary[0]?.trim();
  return n && n.length > 0 ? n : INSTRUCTOR_SELECT_ANY;
}

function linkedSelectValue(p: InstructorPrefsV1, scheduleTypeKey: string): string {
  const n = p.byScheduleType?.[scheduleTypeKey]?.[0]?.trim();
  return n && n.length > 0 ? n : INSTRUCTOR_SELECT_ANY;
}

function mergeOptionList(canonical: string[], current: string): string[] {
  const cur = current.trim();
  if (cur.length === 0 || cur === INSTRUCTOR_SELECT_ANY) return canonical;
  const lower = new Set(canonical.map((s) => s.toLowerCase()));
  if (lower.has(cur.toLowerCase())) return canonical;
  return [cur, ...canonical];
}

/**
 * Counts the unique CRNs across all candidates for a course's pack. Mirrors
 * the section list shown in the section picker so the disclosure label
 * matches the number of pickable sections.
 */
function countSectionsInPack(pack: CourseSolvePack): number {
  const crns = new Set<string>();
  for (const c of pack.candidates) {
    crns.add(c.anchorCrn);
    if (c.selectionKind === "linked_bundle") {
      for (const crn of c.crns) crns.add(crn);
    }
  }
  return crns.size;
}

export function CourseManager({ termCode }: Props) {
  const {
    plannerItems,
    catalog,
    removePlannerItem,
    updatePlannerItem,
    setPlannerItems,
    solvePacks,
    mergeSolvePack,
    toggleSectionPin,
    clearSectionPins,
  } = usePlannerData();
  const { recalculateSolutions, effectivePlannerItems, calendarBlocks } =
    usePlannerSolve();
  const { recordHistorySnapshot } = usePlannerHistory();

  const [pending, startTransition] = useTransition();
  const [searchQ, setSearchQ] = useState("");
  const [searchFetching, setSearchFetching] = useState(false);
  const [hits, setHits] = useState<CourseSearchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<CourseSearchRow | null>(null);
  const [prefetchPackPending, setPrefetchPackPending] = useState(false);
  const [prefetchPackError, setPrefetchPackError] = useState<string | null>(null);

  const [sectionsOpen, setSectionsOpen] = useState<Record<number, boolean>>({});
  const [advancedOpen, setAdvancedOpen] = useState<Record<number, boolean>>({});
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

  const persistPrefs = useCallback(
    (itemId: number, prefs: InstructorPrefsV1) => {
      updatePlannerItem(itemId, { instructorPrefs: prefs });
      void recalculateSolutions();
    },
    [updatePlannerItem, recalculateSolutions],
  );

  const handleColorPickById = useCallback(
    (id: number, hex: string) => {
      updatePlannerItem(id, { displayColor: hex });
    },
    [updatePlannerItem],
  );

  const handleRemoveById = useCallback(
    (id: number) => {
      const removed = plannerItems.find((r) => r.id === id);
      removePlannerItem(id);
      void recalculateSolutions();
      if (removed) {
        track("planner_course_removed", {
          subject: removed.subject,
          courseNumber: removed.courseNumber,
          courseCount: plannerItems.length - 1,
        });
      }
    },
    [removePlannerItem, recalculateSolutions, plannerItems],
  );

  const setPrimaryInstructor = useCallback(
    (item: PlannerItemRow, value: string) => {
      const p = parseInstructorPrefs(item.instructorPrefs);
      const primary =
        value === INSTRUCTOR_SELECT_ANY
          ? []
          : [value.trim()].filter(Boolean);
      persistPrefs(
        item.id,
        serializeInstructorPrefs({
          v: 1,
          primary,
          byScheduleType: p.byScheduleType,
        }),
      );
      track("planner_instructor_pref_set", {
        kind: "primary",
        choseAny: value === INSTRUCTOR_SELECT_ANY,
      });
    },
    [persistPrefs],
  );

  const setLinkedInstructor = useCallback(
    (item: PlannerItemRow, scheduleTypeKey: string, value: string) => {
      const p = parseInstructorPrefs(item.instructorPrefs);
      const nextBy: Record<string, string[]> = { ...(p.byScheduleType ?? {}) };
      if (value === INSTRUCTOR_SELECT_ANY) {
        delete nextBy[scheduleTypeKey];
      } else {
        nextBy[scheduleTypeKey] = [value.trim()].filter(Boolean);
      }
      const keys = Object.keys(nextBy);
      persistPrefs(
        item.id,
        serializeInstructorPrefs({
          v: 1,
          primary: p.primary,
          byScheduleType: keys.length > 0 ? nextBy : undefined,
        }),
      );
      track("planner_instructor_pref_set", {
        kind: "linked",
        choseAny: value === INSTRUCTOR_SELECT_ANY,
      });
    },
    [persistPrefs],
  );

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

  const totalCourses = plannerItems.length;
  const totalCredits = useMemo(
    () =>
      computePlannerCreditHours(
        effectivePlannerItems,
        calendarBlocks,
        catalog.sections,
      ),
    [effectivePlannerItems, calendarBlocks, catalog.sections],
  );
  const summaryText = useMemo(() => {
    if (totalCourses === 0) return "No courses yet.";
    const courseLabel = `${totalCourses} course${totalCourses === 1 ? "" : "s"}`;
    if (totalCredits <= 0) return `${courseLabel}.`;
    return `${courseLabel} (${formatCreditHours(totalCredits)})`;
  }, [totalCourses, totalCredits]);

  return (
    <section
      id="planner-courses"
      className="scroll-mt-20 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
    >
      <Popover open={addOpen} onOpenChange={onAddOpenChange}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-heading text-lg font-medium text-foreground">
              Your courses
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{summaryText}</p>
          </div>
          <PopoverTrigger asChild>
            <Button
              type="button"
              className="min-h-11 shrink-0 touch-manipulation"
            >
              <Plus className="size-4" />
              <span className="ml-2">Add</span>
            </Button>
          </PopoverTrigger>
        </div>

        <PopoverContent
          align="end"
          className="w-80 max-w-[calc(100vw-2rem)] px-3 pt-3 pb-2"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label htmlFor="course-search" className="shrink-0 text-muted-foreground">
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
                  <span className="inline-flex size-3 shrink-0 items-center justify-center">
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                  </span>
                  Searching&hellip;
                </p>
              ) : null}
              {searchQueryLen >= 2 && !searchFetching && !pending && hits.length === 0 ? (
                <p className="truncate text-muted-foreground" role="status">
                  No courses match that search.
                </p>
              ) : null}
              {picked && prefetchPackPending ? (
                <p className="flex max-w-full items-center justify-end gap-1.5 truncate text-muted-foreground">
                  <span className="inline-flex size-3 shrink-0 items-center justify-center">
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                  </span>
                  Loading sections for this course&hellip;
                </p>
              ) : null}
              {pending ? (
                <p
                  className="flex max-w-full items-center justify-end gap-1.5 truncate text-muted-foreground"
                  role="status"
                >
                  <span className="inline-flex size-3 shrink-0 items-center justify-center">
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                  </span>
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
            id="course-search"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="course-search-listbox"
            aria-activedescendant={
              searchActiveIndex >= 0
                ? `course-search-hit-${searchActiveIndex}`
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
              id="course-search-listbox"
              className="mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-sm"
              role="listbox"
              aria-label="Course search results"
            >
              {hits.map((h, idx) => (
                <li key={`${h.subject}-${h.courseNumber}`} role="none">
                  <button
                    type="button"
                    id={`course-search-hit-${idx}`}
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
                      <span className="text-muted-foreground">
                        {h.previewTitle}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </PopoverContent>
      </Popover>

      <ul className="mt-6 space-y-2">
        {plannerItems.map((item) => {
          const packKey = courseSolvePackCourseKey(item.subject, item.courseNumber);
          const pack = solvePacks[packKey];
          const prefs = parseInstructorPrefs(item.instructorPrefs);
          const primaryOpts = pack ? primaryInstructorOptions(pack) : [];
          const primaryVal = primarySelectValue(prefs);
          const primaryChoices = mergeOptionList(primaryOpts, primaryVal);
          const linkedRows = pack ? linkedScheduleTypeRows(pack) : [];
          const sectionCount = pack ? countSectionsInPack(pack) : 0;
          const isSectionsOpen = sectionsOpen[item.id] === true;
          const isAdvancedOpen = advancedOpen[item.id] === true;
          const pinnedTypes = parseSectionPinsJson(item.sectionPins).byType;
          const pinnedCount = Object.keys(pinnedTypes).length;
          const instructorPill = primaryVal === INSTRUCTOR_SELECT_ANY
            ? "Any instructor"
            : primaryVal;

          return (
            <li
              key={item.id}
              id={`planner-course-${item.id}`}
              className="rounded-lg border border-border bg-muted/15 p-2 sm:p-3"
            >
              <div className="flex items-center gap-2">
                <CourseRowColorCell
                  itemId={item.id}
                  displayColor={item.displayColor}
                  disabled={pending}
                  onPickById={handleColorPickById}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-mono text-sm font-medium text-foreground">
                      {item.subject} {item.courseNumber}
                    </p>
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        primaryVal === INSTRUCTOR_SELECT_ANY
                          ? "rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-muted-foreground"
                          : "inline-flex items-center gap-0.5 rounded-md border border-primary/40 bg-primary/10 pl-1.5 pr-0.5 py-0.5 text-primary",
                      )}
                      title={
                        primaryVal === INSTRUCTOR_SELECT_ANY
                          ? "No instructor filter set"
                          : `Instructor filter: ${primaryVal}`
                      }
                    >
                      {instructorPill}
                      {primaryVal !== INSTRUCTOR_SELECT_ANY ? (
                        <button
                          type="button"
                          className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Clear instructor filter for ${item.subject} ${item.courseNumber}`}
                          disabled={
                            pending || item.selectionKind !== "unresolved"
                          }
                          onClick={() =>
                            setPrimaryInstructor(item, INSTRUCTOR_SELECT_ANY)
                          }
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      ) : null}
                    </span>
                    {pinnedCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded-md border border-primary/40 bg-primary/10 pl-1.5 pr-0.5 py-0.5 text-[10px] font-medium text-primary">
                        {pinnedCount} pinned
                        <button
                          type="button"
                          className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Clear all pinned sections for ${item.subject} ${item.courseNumber}`}
                          disabled={
                            pending || item.selectionKind !== "unresolved"
                          }
                          onClick={() => clearSectionPins(item.id)}
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </span>
                    ) : null}
                    {item.selectionKind !== "unresolved" ? (
                      <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Locked CRNs
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground"
                    aria-expanded={isSectionsOpen}
                    aria-controls={`sections-${item.id}`}
                    disabled={!pack}
                    onClick={() =>
                      setSectionsOpen((m) => ({ ...m, [item.id]: !isSectionsOpen }))
                    }
                  >
                    {isSectionsOpen ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                    {pack
                      ? `${sectionCount} section${sectionCount === 1 ? "" : "s"}`
                      : "Loading sections…"}
                  </button>
                </div>
                <CourseRowRemoveButton
                  itemId={item.id}
                  ariaLabel={`Remove ${item.subject} ${item.courseNumber}`}
                  disabled={pending}
                  onRemoveById={handleRemoveById}
                />
              </div>

              {isSectionsOpen && pack ? (
                <div
                  id={`sections-${item.id}`}
                  className="mt-2 space-y-3 rounded-md border border-border/60 bg-background p-2"
                >
                  <div>
                    <Label
                      className="text-muted-foreground"
                      htmlFor={`primary-${item.id}`}
                    >
                      Instructor (lecture)
                    </Label>
                    <Select
                      value={primaryVal}
                      onValueChange={(v) => setPrimaryInstructor(item, v)}
                    >
                      <SelectTrigger
                        id={`primary-${item.id}`}
                        className="mt-1 min-h-10 w-full font-mono text-sm"
                      >
                        <SelectValue placeholder="Choose instructor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={INSTRUCTOR_SELECT_ANY}>Any</SelectItem>
                        {primaryChoices.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {linkedRows.length > 0 ? (
                    <div>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        aria-expanded={isAdvancedOpen}
                        aria-controls={`advanced-${item.id}`}
                        onClick={() =>
                          setAdvancedOpen((m) => ({
                            ...m,
                            [item.id]: !isAdvancedOpen,
                          }))
                        }
                      >
                        {isAdvancedOpen ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                        Linked labs and discussions
                      </button>
                      {isAdvancedOpen ? (
                        <div
                          id={`advanced-${item.id}`}
                          className="mt-2 space-y-3 rounded-md border border-border/60 bg-muted/20 p-2"
                        >
                          {linkedRows.map((row) => {
                            const lv = linkedSelectValue(prefs, row.scheduleTypeKey);
                            const choices = mergeOptionList(
                              row.instructorOptions,
                              lv,
                            );
                            const fieldId = `linked-${item.id}-${row.scheduleTypeKey}`;
                            return (
                              <div key={row.scheduleTypeKey} className="space-y-1">
                                <Label
                                  htmlFor={fieldId}
                                  className="text-xs text-muted-foreground"
                                >
                                  Instructor ({row.label})
                                </Label>
                                <Select
                                  value={lv}
                                  onValueChange={(v) =>
                                    setLinkedInstructor(item, row.scheduleTypeKey, v)
                                  }
                                >
                                  <SelectTrigger
                                    id={fieldId}
                                    className="min-h-10 w-full font-mono text-sm"
                                  >
                                    <SelectValue placeholder="Choose instructor" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={INSTRUCTOR_SELECT_ANY}>
                                      Any
                                    </SelectItem>
                                    {choices.map((name) => (
                                      <SelectItem key={name} value={name}>
                                        {name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Sections
                    </p>
                    <CourseSectionPicker
                      item={item}
                      pack={pack}
                      catalog={catalog}
                      onTogglePin={toggleSectionPin}
                      disabled={pending}
                    />
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {plannerItems.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Tap Add to search for a course.
        </p>
      ) : null}
    </section>
  );
}
