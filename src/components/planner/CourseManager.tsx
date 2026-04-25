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
  parseInstructorPrefs,
  serializeInstructorPrefs,
  type InstructorPrefsV1,
} from "@/lib/planner/instructor-prefs";
import { courseSolvePackCourseKey } from "@/lib/planner/solve-schedules-core";
import { normalizeScheduleTypeKey } from "@/lib/planner/swap-helpers";
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

const COLOR_OPTIONS = [
  "#8B4513",
  "#2F4F4F",
  "#556B2F",
  "#4A3728",
  "#5C4033",
  "#355E3B",
  "#654321",
  "#3D4F3D",
] as const;

type Props = { termCode: string };

type AdvancedRow = { id: string; scheduleTypeLabel: string; names: string };

function advancedRowsFromPrefs(
  itemId: number,
  p: InstructorPrefsV1,
): AdvancedRow[] {
  if (!p.byScheduleType) return [];
  return Object.entries(p.byScheduleType).map(([key, names]) => ({
    id: `${itemId}-${key}`,
    scheduleTypeLabel: key,
    names: names.join(", "),
  }));
}

function prefsFromRows(
  primary: string[],
  advancedRows: AdvancedRow[],
): InstructorPrefsV1 {
  const byScheduleType: Record<string, string[]> = {};
  for (const row of advancedRows) {
    const key = normalizeScheduleTypeKey(row.scheduleTypeLabel);
    if (!key) continue;
    const parts = row.names
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) byScheduleType[key] = parts;
  }
  return serializeInstructorPrefs({
    v: 1,
    primary,
    byScheduleType:
      Object.keys(byScheduleType).length > 0 ? byScheduleType : undefined,
  });
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
  const [color, setColor] = useState<string>(COLOR_OPTIONS[0]!);

  const [advancedOpen, setAdvancedOpen] = useState<Record<number, boolean>>({});
  const [advancedDraft, setAdvancedDraft] = useState<
    Record<number, AdvancedRow[]>
  >({});

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
        displayColor: color,
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
  }, [picked, termCode, color, refreshCatalogFromServer, recalculateSolutions]);

  const persistPrefs = useCallback(
    (itemId: number, prefs: InstructorPrefsV1) => {
      updatePlannerItem(itemId, { instructorPrefs: prefs });
      void recalculateSolutions();
    },
    [updatePlannerItem, recalculateSolutions],
  );

  const onPrimaryBlur = useCallback(
    (item: PlannerItemRow, value: string) => {
      const primary = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const p = parseInstructorPrefs(item.instructorPrefs);
      const rows =
        advancedDraft[item.id] ?? advancedRowsFromPrefs(item.id, p);
      persistPrefs(item.id, prefsFromRows(primary, rows));
    },
    [advancedDraft, persistPrefs],
  );

  const getAdvancedRows = (item: PlannerItemRow): AdvancedRow[] => {
    if (advancedDraft[item.id]) return advancedDraft[item.id]!;
    return advancedRowsFromPrefs(
      item.id,
      parseInstructorPrefs(item.instructorPrefs),
    );
  };

  const setAdvancedRowsForItem = (
    item: PlannerItemRow,
    rows: AdvancedRow[],
  ) => {
    setAdvancedDraft((d) => ({ ...d, [item.id]: rows }));
  };

  const flushAdvanced = (item: PlannerItemRow) => {
    const p = parseInstructorPrefs(item.instructorPrefs);
    const rows = advancedDraft[item.id] ?? getAdvancedRows(item);
    persistPrefs(item.id, prefsFromRows(p.primary, rows));
  };

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
        <div className="min-w-0 flex-1">
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
        <div className="flex flex-col gap-2 sm:w-44">
          <Label className="text-muted-foreground">Color</Label>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLOR_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-3.5 rounded-sm border border-border"
                      style={{ backgroundColor: c }}
                    />
                    {c}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        {plannerItems.map((item, idx) => (
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
                <Select
                  value={item.displayColor}
                  onValueChange={(v) => {
                    startTransition(async () => {
                      await updatePlannerItemColorAction(item.id, v);
                      await refreshCatalogFromServer();
                      void recalculateSolutions();
                    });
                  }}
                >
                  <SelectTrigger size="sm" className="w-[7.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span
                          className="inline-block size-3 rounded-sm border border-border"
                          style={{ backgroundColor: c }}
                        />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                Preferred instructors (lecture)
              </Label>
              <Input
                id={`primary-${item.id}`}
                className="mt-1 font-mono text-sm"
                placeholder="Last name or partial, comma-separated"
                defaultValue={parseInstructorPrefs(item.instructorPrefs).primary.join(
                  ", ",
                )}
                key={`${item.id}-${JSON.stringify(item.instructorPrefs)}`}
                onBlur={(e) => onPrimaryBlur(item, e.target.value)}
              />
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
                Advanced (labs, discussions by type)
              </button>
              {advancedOpen[item.id] ? (
                <div className="mt-2 space-y-2 rounded-md border border-border bg-background p-3">
                  {(advancedDraft[item.id] ?? getAdvancedRows(item)).map(
                    (row) => (
                      <div
                        key={row.id}
                        className="flex flex-col gap-2 sm:flex-row sm:items-end"
                      >
                        <div className="min-w-0 flex-1">
                          <Label className="text-xs text-muted-foreground">
                            Schedule type (e.g. Laboratory, Lecture)
                          </Label>
                          <Input
                            className="mt-0.5 font-mono text-sm"
                            value={row.scheduleTypeLabel}
                            onChange={(e) => {
                              const list =
                                advancedDraft[item.id] ?? getAdvancedRows(item);
                              setAdvancedRowsForItem(
                                item,
                                list.map((r) =>
                                  r.id === row.id
                                    ? { ...r, scheduleTypeLabel: e.target.value }
                                    : r,
                                ),
                              );
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-[2]">
                          <Label className="text-xs text-muted-foreground">
                            Preferred names (comma-separated)
                          </Label>
                          <Input
                            className="mt-0.5 font-mono text-sm"
                            value={row.names}
                            onChange={(e) => {
                              const list =
                                advancedDraft[item.id] ?? getAdvancedRows(item);
                              setAdvancedRowsForItem(
                                item,
                                list.map((r) =>
                                  r.id === row.id
                                    ? { ...r, names: e.target.value }
                                    : r,
                                ),
                              );
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const list = (
                              advancedDraft[item.id] ?? getAdvancedRows(item)
                            ).filter((r) => r.id !== row.id);
                            setAdvancedRowsForItem(item, list);
                            const p = parseInstructorPrefs(item.instructorPrefs);
                            persistPrefs(item.id, prefsFromRows(p.primary, list));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ),
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const list =
                        advancedDraft[item.id] ?? getAdvancedRows(item);
                      setAdvancedRowsForItem(item, [
                        ...list,
                        {
                          id: `${item.id}-${Date.now()}`,
                          scheduleTypeLabel: "",
                          names: "",
                        },
                      ]);
                    }}
                  >
                    Add row
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => flushAdvanced(item)}
                  >
                    Apply advanced preferences
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {plannerItems.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No courses yet. Search and add at least one.
        </p>
      ) : null}
    </section>
  );
}
