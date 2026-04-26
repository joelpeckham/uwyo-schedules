"use client";

import {
  addPlannerCourseWishAction,
  prefetchCourseSolvePackAction,
  reorderPlannerItemAction,
  searchCoursesAction,
  updatePlannerItemColorAction,
} from "@/app/planner/actions";
import type { CourseSearchRow } from "@/lib/planner/data";
import type { PlannerItemRow } from "@/lib/planner/data";
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
import { courseSolvePackCourseKey } from "@/lib/planner/solve-schedules-core";
import { PlannerCourseColorPicker } from "@/components/planner/PlannerCourseColorPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { usePlanner } from "./PlannerContext";

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

export function CourseManager({ termCode }: Props) {
  const {
    plannerItems,
    refreshCatalogFromServer,
    removePlannerItem,
    updatePlannerItem,
    recalculateSolutions,
    syncError,
    clearSyncError,
    solvePacks,
    mergeSolvePack,
  } = usePlanner();

  const [pending, startTransition] = useTransition();
  const [searchQ, setSearchQ] = useState("");
  const [hits, setHits] = useState<CourseSearchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<CourseSearchRow | null>(null);
  const [prefetchPackPending, setPrefetchPackPending] = useState(false);
  const [prefetchPackError, setPrefetchPackError] = useState<string | null>(null);

  const [advancedOpen, setAdvancedOpen] = useState<Record<number, boolean>>({});

  const runSearch = useCallback(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    startTransition(async () => {
      const rows = await searchCoursesAction(termCode, q);
      setHits(rows);
    });
  }, [searchQ, termCode]);

  useEffect(() => {
    const t = setTimeout(runSearch, 200);
    return () => clearTimeout(t);
  }, [runSearch]);

  useEffect(() => {
    void recalculateSolutions();
  }, [recalculateSolutions, termCode]);

  useEffect(() => {
    if (!picked) {
      setPrefetchPackPending(false);
      setPrefetchPackError(null);
      return;
    }
    setPrefetchPackPending(true);
    setPrefetchPackError(null);
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
  const hasPackForPicked = Boolean(
    picked && solvePacks[pickedPackKey],
  );

  const submitAdd = useCallback(() => {
    if (!picked) return;
    setError(null);
    startTransition(async () => {
      const res = await addPlannerCourseWishAction({
        termCode,
        subject: picked.subject,
        courseNumber: picked.courseNumber,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const ok = await refreshCatalogFromServer();
      if (!ok) {
        setError("Added course but could not reload data. Reload the page.");
        return;
      }
      await recalculateSolutions();
      setPicked(null);
      setHits([]);
      setSearchQ("");
    });
  }, [picked, termCode, refreshCatalogFromServer, recalculateSolutions]);

  const persistPrefs = useCallback(
    (itemId: number, prefs: InstructorPrefsV1) => {
      updatePlannerItem(itemId, { instructorPrefs: prefs });
      void recalculateSolutions();
    },
    [updatePlannerItem, recalculateSolutions],
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
    },
    [persistPrefs],
  );

  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <h2 className="font-heading text-lg font-medium text-foreground">
        Your courses
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Add each class and optional instructor preferences. We find full schedules
        that fit together.
      </p>

      {(error || syncError) && (
        <div
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error ?? syncError}
          {syncError ? (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => clearSyncError()}
            >
              Dismiss
            </button>
          ) : null}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 sm:min-w-48">
          <Label htmlFor="course-search" className="text-muted-foreground">
            Search courses
          </Label>
          <Input
            id="course-search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Subject or number"
            className="mt-1 min-h-11"
            autoComplete="off"
          />
          {hits.length > 0 ? (
            <ul
              className="mt-1 max-h-48 overflow-auto rounded-md border border-border bg-background"
              role="listbox"
            >
              {hits.map((h) => (
                <li key={`${h.subject}-${h.courseNumber}`} role="option">
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-muted/60",
                      picked?.subject === h.subject &&
                        picked?.courseNumber === h.courseNumber &&
                        "bg-muted",
                    )}
                    onClick={() => setPicked(h)}
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
          {picked && prefetchPackPending ? (
            <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
              Loading section data for this course…
            </p>
          ) : null}
          {picked && prefetchPackError ? (
            <p
              className="mt-1 text-xs text-destructive"
              role="alert"
              aria-live="polite"
            >
              {prefetchPackError}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          className="min-h-11 touch-manipulation"
          disabled={
            !picked ||
            pending ||
            prefetchPackPending ||
            Boolean(prefetchPackError) ||
            !hasPackForPicked
          }
          onClick={submitAdd}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          <span className="ml-2">Add</span>
        </Button>
      </div>

      <ul className="mt-6 space-y-3">
        {plannerItems.map((item, idx) => {
          const packKey = courseSolvePackCourseKey(item.subject, item.courseNumber);
          const pack = solvePacks[packKey];
          const prefs = parseInstructorPrefs(item.instructorPrefs);
          const primaryOpts = pack ? primaryInstructorOptions(pack) : [];
          const primaryVal = primarySelectValue(prefs);
          const primaryChoices = mergeOptionList(primaryOpts, primaryVal);
          const linkedRows = pack ? linkedScheduleTypeRows(pack) : [];

          return (
          <li
            key={item.id}
            className="rounded-lg border border-border bg-muted/20 p-3 sm:p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium text-foreground">
                  {item.subject} {item.courseNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.selectionKind === "unresolved"
                    ? "Sections chosen automatically from valid schedules"
                    : "Resolved from an earlier version"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={idx === 0 || pending}
                  onClick={() =>
                    startTransition(() =>
                      reorderPlannerItemAction(item.id, "up").then(() =>
                        refreshCatalogFromServer().then((ok) => {
                          if (ok) void recalculateSolutions();
                        }),
                      ),
                    )
                  }
                >
                  Up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={idx >= plannerItems.length - 1 || pending}
                  onClick={() =>
                    startTransition(() =>
                      reorderPlannerItemAction(item.id, "down").then(() =>
                        refreshCatalogFromServer().then((ok) => {
                          if (ok) void recalculateSolutions();
                        }),
                      ),
                    )
                  }
                >
                  Down
                </Button>
                <PlannerCourseColorPicker
                  displayColor={item.displayColor}
                  disabled={pending}
                  onPick={(hex) => {
                    startTransition(async () => {
                      await updatePlannerItemColorAction(item.id, hex);
                      await refreshCatalogFromServer();
                      void recalculateSolutions();
                    });
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => {
                    removePlannerItem(item.id);
                    void recalculateSolutions();
                  }}
                  aria-label={`Remove ${item.subject} ${item.courseNumber}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <div className="mt-3">
              <Label
                htmlFor={`primary-${item.id}`}
                className="text-muted-foreground"
              >
                Instructor (lecture)
              </Label>
              {!pack ? (
                <p
                  id={`primary-${item.id}`}
                  className="mt-1 text-sm text-muted-foreground"
                >
                  Loading section options…
                </p>
              ) : (
                <Select
                  value={primaryVal}
                  onValueChange={(v) => setPrimaryInstructor(item, v)}
                >
                  <SelectTrigger
                    id={`primary-${item.id}`}
                    className="mt-1 min-h-11 w-full max-w-md font-mono text-sm"
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
              )}
            </div>

            <div className="mt-2">
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setAdvancedOpen((o) => ({
                    ...o,
                    [item.id]: !o[item.id],
                  }))
                }
              >
                {advancedOpen[item.id] ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
                Advanced (linked labs and discussions)
              </button>
              {advancedOpen[item.id] ? (
                <div className="mt-2 space-y-3 rounded-md border border-border bg-background p-3">
                  {!pack ? (
                    <p className="text-sm text-muted-foreground">
                      Loading section options…
                    </p>
                  ) : linkedRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No linked section types for this course.
                    </p>
                  ) : (
                    linkedRows.map((row) => {
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
                              className="min-h-11 w-full max-w-md font-mono text-sm"
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
                    })
                  )}
                </div>
              ) : null}
            </div>
          </li>
          );
        })}
      </ul>

      {plannerItems.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No courses yet. Search and add at least one.
        </p>
      ) : null}
    </section>
  );
}
