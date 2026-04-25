"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  addPlannerItemAction,
  listLinkedBundleOptionsAction,
  listSectionsForCourseAction,
  searchCoursesAction,
} from "@/app/planner/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COLOR_PRESETS,
  DEFAULT_DISPLAY_COLOR,
} from "@/lib/planner/constants";
import type {
  CourseSearchRow,
  LinkedBundleOption,
  PlannerItemRow,
} from "@/lib/planner/data";
import type { SelectionKind } from "@/lib/planner/resolve-display-crns";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlanner } from "./PlannerContext";

type SectionRow = Awaited<
  ReturnType<typeof listSectionsForCourseAction>
>[number];

type CourseRow = CourseSearchRow;

type Props = {
  termCode: string;
};

function reorderPlannerItemsLocal(
  items: PlannerItemRow[],
  itemId: number,
  direction: "up" | "down",
): PlannerItemRow[] {
  const sorted = [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
  );
  const idx = sorted.findIndex((i) => i.id === itemId);
  const j = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || j < 0 || j >= sorted.length) return items;
  const copy = [...sorted];
  const tmp = copy[idx]!;
  copy[idx] = copy[j]!;
  copy[j] = tmp;
  return copy.map((row, i) => ({ ...row, sortOrder: i }));
}

const SEARCH_DEBOUNCE_MS = 300;
const BLUR_CLOSE_MS = 200;

export function CourseManager({ termCode }: Props) {
  const {
    plannerItems,
    setPlannerItems,
    removePlannerItem,
    updatePlannerItem,
    refreshCatalogFromServer,
    syncError,
    clearSyncError,
  } = usePlanner();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const listId = useId();
  const inputId = useId();
  const blurCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [hits, setHits] = useState<CourseRow[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const [picked, setPicked] = useState<CourseRow | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [anchorCrn, setAnchorCrn] = useState<string | null>(null);
  const [bundles, setBundles] = useState<LinkedBundleOption[]>([]);
  const [bundleId, setBundleId] = useState<number | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_DISPLAY_COLOR);
  const [hexDraft, setHexDraft] = useState("");

  const [editItem, setEditItem] = useState<PlannerItemRow | null>(null);
  const [editSections, setEditSections] = useState<SectionRow[]>([]);
  const [editAnchor, setEditAnchor] = useState<string | null>(null);
  const [editBundles, setEditBundles] = useState<LinkedBundleOption[]>([]);
  const [editBundleId, setEditBundleId] = useState<number | null>(null);

  const resetAddFlow = useCallback(() => {
    setPicked(null);
    setSections([]);
    setAnchorCrn(null);
    setBundles([]);
    setBundleId(null);
    setColor(DEFAULT_DISPLAY_COLOR);
    setHexDraft("");
    setError(null);
    setListOpen(false);
    setHighlight(-1);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(searchQ.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    if (termCode.length === 0 || debouncedQ.length < 2) {
      void Promise.resolve().then(() => {
        setHits([]);
      });
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      setError(null);
      const rows = await searchCoursesAction(termCode, debouncedQ);
      if (!cancelled) setHits(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [termCode, debouncedQ, startTransition]);

  const pickCourse = useCallback(
    (row: CourseRow) => {
      setError(null);
      setListOpen(false);
      setHighlight(-1);
      if (blurCloseRef.current) {
        clearTimeout(blurCloseRef.current);
        blurCloseRef.current = null;
      }
      setPicked(row);
      setAnchorCrn(null);
      setBundles([]);
      setBundleId(null);
      startTransition(async () => {
        const sec = await listSectionsForCourseAction(
          termCode,
          row.subject,
          row.courseNumber,
        );
        setSections(sec);
      });
    },
    [termCode],
  );

  const scheduleCloseList = useCallback(() => {
    if (blurCloseRef.current) clearTimeout(blurCloseRef.current);
    blurCloseRef.current = setTimeout(() => {
      setListOpen(false);
      blurCloseRef.current = null;
    }, BLUR_CLOSE_MS);
  }, []);

  const cancelCloseList = useCallback(() => {
    if (blurCloseRef.current) {
      clearTimeout(blurCloseRef.current);
      blurCloseRef.current = null;
    }
  }, []);

  const pickAnchor = useCallback(
    (crn: string) => {
      setAnchorCrn(crn);
      setBundleId(null);
      setError(null);
      startTransition(async () => {
        const b = await listLinkedBundleOptionsAction(termCode, crn);
        setBundles(b);
      });
    },
    [termCode],
  );

  const submitAdd = useCallback(() => {
    if (!picked || !anchorCrn) return;
    setError(null);
    const kind: SelectionKind =
      bundles.length > 0 ? "linked_bundle" : "single_crn";
    const linkedId = kind === "linked_bundle" ? bundleId : null;
    if (kind === "linked_bundle" && linkedId == null) {
      setError("Choose a linked registration option.");
      return;
    }
    startTransition(async () => {
      const res = await addPlannerItemAction({
        termCode,
        subject: picked.subject,
        courseNumber: picked.courseNumber,
        anchorCrn,
        selectionKind: kind,
        linkedBundleId: linkedId,
        displayColor: color,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const ok = await refreshCatalogFromServer();
      if (!ok) {
        setError("Added course but could not reload schedule data. Reload the page.");
      }
      resetAddFlow();
      setHits([]);
      setSearchQ("");
    });
  }, [
    picked,
    anchorCrn,
    bundles.length,
    bundleId,
    termCode,
    color,
    resetAddFlow,
    refreshCatalogFromServer,
  ]);

  const openEdit = useCallback(
    (item: PlannerItemRow) => {
      setEditItem(item);
      setEditAnchor(item.anchorCrn);
      setEditBundleId(item.linkedBundleId);
      setError(null);
      startTransition(async () => {
        const sec = await listSectionsForCourseAction(
          termCode,
          item.subject,
          item.courseNumber,
        );
        setEditSections(sec);
        const b = await listLinkedBundleOptionsAction(
          termCode,
          item.anchorCrn,
        );
        setEditBundles(b);
      });
    },
    [termCode],
  );

  const submitEdit = useCallback(() => {
    if (!editItem || !editAnchor) return;
    setError(null);
    const kind: SelectionKind =
      editBundles.length > 0 ? "linked_bundle" : "single_crn";
    const linkedId = kind === "linked_bundle" ? editBundleId : null;
    if (kind === "linked_bundle" && linkedId == null) {
      setError("Choose a linked registration option.");
      return;
    }
    updatePlannerItem(editItem.id, {
      anchorCrn: editAnchor,
      selectionKind: kind,
      linkedBundleId: linkedId,
    });
    setEditItem(null);
  }, [editItem, editAnchor, editBundles.length, editBundleId, updatePlannerItem]);

  const onEditAnchorChange = useCallback(
    (crn: string) => {
      setEditAnchor(crn);
      setEditBundleId(null);
      startTransition(async () => {
        const b = await listLinkedBundleOptionsAction(termCode, crn);
        setEditBundles(b);
      });
    },
    [termCode],
  );

  const applyHex = useCallback(() => {
    const v = hexDraft.trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(v)) {
      setError("Enter a color like #a65d3a.");
      return;
    }
    setColor(v);
    setError(null);
  }, [hexDraft]);

  const sortedItems = useMemo(
    () => [...plannerItems].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [plannerItems],
  );

  const searchSynced = searchQ.trim() === debouncedQ;
  const showListSearching =
    (searchQ.trim().length >= 2 && !searchSynced) ||
    (searchSynced && pending && hits.length === 0 && debouncedQ.length >= 2);

  const rowHighlight = useMemo(() => {
    if (!listOpen || hits.length === 0) return -1;
    const h = highlight < 0 ? 0 : highlight;
    return Math.min(h, hits.length - 1);
  }, [listOpen, hits, highlight]);

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
      aria-labelledby="course-manager-heading"
    >
      <h2
        id="course-manager-heading"
        className="font-heading text-lg font-medium text-foreground"
      >
        Your courses
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Type a subject, number, title, CRN, or keyword. Results appear as you
        type. Pick a section or linked combination, then choose a color for the
        calendar stripe.
      </p>

      {error ? (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {syncError ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>Could not save planner: {syncError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            onClick={() => clearSyncError()}
          >
            Dismiss
          </Button>
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <Label htmlFor={inputId} className="text-muted-foreground">
          Search courses
        </Label>
        <div className="relative">
          <Input
            id={inputId}
            role="combobox"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              listOpen && rowHighlight >= 0 && hits[rowHighlight]
                ? `${listId}-opt-${rowHighlight}`
                : undefined
            }
            value={searchQ}
            onChange={(e) => {
              const v = e.target.value;
              setSearchQ(v);
              if (v.trim().length >= 2) setListOpen(true);
              else {
                setListOpen(false);
                setHighlight(-1);
              }
            }}
            onFocus={() => {
              cancelCloseList();
              if (searchQ.trim().length >= 2) setListOpen(true);
            }}
            onBlur={scheduleCloseList}
            placeholder="Subject, number, title, CRN…"
            className="min-h-11 w-full"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setListOpen(false);
                setHighlight(-1);
                return;
              }
              if (!listOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                if (hits.length > 0) {
                  e.preventDefault();
                  setListOpen(true);
                  setHighlight(e.key === "ArrowDown" ? 0 : hits.length - 1);
                }
                return;
              }
              if (!listOpen) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) =>
                  h < hits.length - 1 ? h + 1 : hits.length - 1,
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => (h > 0 ? h - 1 : 0));
              } else if (e.key === "Enter") {
                if (rowHighlight >= 0 && hits[rowHighlight]) {
                  e.preventDefault();
                  pickCourse(hits[rowHighlight]!);
                }
              }
            }}
          />
          {listOpen && searchQ.trim().length >= 2 && termCode.length > 0 ? (
            <div
              id={listId}
              role="listbox"
              aria-label="Matching courses"
              className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
            >
              {showListSearching ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  Searching…
                </p>
              ) : hits.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  No matches. Try another word or CRN.
                </p>
              ) : (
                hits.map((h, i) => (
                  <button
                    key={`${h.subject}-${h.courseNumber}`}
                    id={`${listId}-opt-${i}`}
                    type="button"
                    role="option"
                    aria-selected={rowHighlight === i}
                    className={[
                      "touch-manipulation w-full px-3 py-3 text-left text-sm sm:py-2.5",
                      rowHighlight === i ? "bg-muted" : "active:bg-muted/80",
                    ].join(" ")}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      pickCourse(h);
                    }}
                  >
                    <span className="font-mono font-medium text-foreground">
                      {h.subjectCourse ?? `${h.subject} ${h.courseNumber}`}
                    </span>
                    {h.previewTitle ? (
                      <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                        {h.previewTitle}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      {picked ? (
        <div className="mt-6 space-y-3 border-t border-border pt-4">
          <p className="font-mono text-sm font-medium">
            Adding {picked.subject} {picked.courseNumber}
          </p>
          <p className="text-sm text-muted-foreground">Pick one section row.</p>
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {sections.map((s) => (
              <li key={s.crn}>
                <button
                  type="button"
                  className={[
                    "touch-manipulation w-full rounded-md px-3 py-3 text-left text-sm sm:py-2",
                    anchorCrn === s.crn ? "bg-muted" : "active:bg-muted/80",
                  ].join(" ")}
                  onClick={() => pickAnchor(s.crn)}
                >
                  <span className="block font-mono text-xs text-foreground">
                    CRN {s.crn}
                    {s.scheduleTypeDescription
                      ? ` · ${s.scheduleTypeDescription}`
                      : ""}
                  </span>
                  {s.courseTitle ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {s.courseTitle}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>

          {anchorCrn && bundles.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Linked registration options
              </p>
              <p className="text-xs text-muted-foreground">
                Pick one valid combination. Outer options are alternatives.
              </p>
              <ul className="space-y-1">
                {bundles.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className={[
                        "touch-manipulation w-full rounded-md border border-border px-3 py-3 text-left text-sm sm:py-2",
                        bundleId === b.id ? "border-primary bg-muted" : "active:bg-muted/60",
                      ].join(" ")}
                      onClick={() => setBundleId(b.id)}
                    >
                      <span className="font-mono text-xs">Option {b.bundleIndex + 1}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {b.summary}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {anchorCrn ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Stripe color</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.hex}
                    aria-pressed={color === p.hex}
                    className="touch-manipulation size-11 rounded-md border-2 border-border shadow-sm active:scale-95 sm:size-9"
                    style={{
                      backgroundColor: p.hex,
                      outlineColor: color === p.hex ? "var(--ring)" : undefined,
                      outlineWidth: color === p.hex ? 2 : 0,
                      outlineStyle: "solid",
                    }}
                    onClick={() => {
                      setColor(p.hex);
                      setError(null);
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="hex-color" className="text-muted-foreground">
                    Custom hex
                  </Label>
                  <Input
                    id="hex-color"
                    className="min-h-11 font-mono"
                    placeholder="#a65d3a"
                    value={hexDraft}
                    onChange={(e) => setHexDraft(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 touch-manipulation"
                  onClick={applyHex}
                >
                  Apply hex
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="min-h-11 touch-manipulation"
                  disabled={
                    pending ||
                    (bundles.length > 0 && bundleId == null)
                  }
                  onClick={submitAdd}
                >
                  Add to planner
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 touch-manipulation"
                  onClick={resetAddFlow}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-foreground">On your list</h3>
        {sortedItems.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No courses yet. Search and add one above.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sortedItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block size-3 shrink-0 rounded-sm border border-border"
                      style={{ backgroundColor: item.displayColor }}
                      aria-hidden
                    />
                    <span className="truncate font-mono text-sm font-medium">
                      {item.subject} {item.courseNumber}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    CRN {item.anchorCrn}
                    {item.linkedBundleId != null ? " · linked bundle" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {COLOR_PRESETS.map((p) => (
                      <button
                        key={`${item.id}-${p.id}`}
                        type="button"
                        aria-label={`Color ${p.id}`}
                        aria-pressed={item.displayColor === p.hex}
                        className="touch-manipulation size-9 rounded border border-border active:scale-95"
                        style={{ backgroundColor: p.hex }}
                        onClick={() => {
                          updatePlannerItem(item.id, { displayColor: p.hex });
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10 touch-manipulation"
                    onClick={() =>
                      setPlannerItems(
                        reorderPlannerItemsLocal(plannerItems, item.id, "up"),
                      )
                    }
                  >
                    Move up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10 touch-manipulation"
                    onClick={() =>
                      setPlannerItems(
                        reorderPlannerItemsLocal(plannerItems, item.id, "down"),
                      )
                    }
                  >
                    Move down
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-10 touch-manipulation"
                    onClick={() => openEdit(item)}
                  >
                    Change sections
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="min-h-10 touch-manipulation"
                    onClick={() => removePlannerItem(item.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editItem
                ? `Sections · ${editItem.subject} ${editItem.courseNumber}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Pick the anchor section, then a linked option if required.
            </p>
            <ul className="space-y-1 rounded-md border border-border p-2">
              {editSections.map((s) => (
                <li key={s.crn}>
                  <button
                    type="button"
                    className={[
                      "touch-manipulation w-full rounded-md px-3 py-3 text-left text-sm sm:py-2",
                      editAnchor === s.crn ? "bg-muted" : "active:bg-muted/80",
                    ].join(" ")}
                    onClick={() => onEditAnchorChange(s.crn)}
                  >
                    <span className="font-mono text-xs">CRN {s.crn}</span>
                    {s.scheduleTypeDescription ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {s.scheduleTypeDescription}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            {editBundles.length > 0 ? (
              <ul className="space-y-1">
                {editBundles.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className={[
                        "touch-manipulation w-full rounded-md border border-border px-3 py-3 text-left text-sm sm:py-2",
                        editBundleId === b.id
                          ? "border-primary bg-muted"
                          : "active:bg-muted/60",
                      ].join(" ")}
                      onClick={() => setEditBundleId(b.id)}
                    >
                      <span className="font-mono text-xs">
                        Option {b.bundleIndex + 1}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {b.summary}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 touch-manipulation"
              onClick={() => setEditItem(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11 touch-manipulation"
              onClick={submitEdit}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
