"use client";

import {
  listSameTypeSwapGhostsFromCatalog,
  resolvePlannerSwapClient,
} from "@/lib/planner/client/derive";
import { parseSectionPinsJson } from "@/lib/planner/section-pins";
import type { CalendarBlock, SwapGhostMeeting } from "@/lib/planner/data";
import {
  blackoutsDocToTimeIntervals,
  clampInterval,
  snapIntervalEndpoints,
  type PlannerBlackoutItemV1,
} from "@/lib/planner/blackouts";
import {
  CALENDAR_END_HOUR,
  CALENDAR_HOUR_COUNT,
  CALENDAR_START_HOUR,
} from "@/lib/planner/constants";
import type { PlannerItemRow } from "@/lib/planner/data";
import { filterFeasibleSwapGhosts } from "@/lib/planner/planner-swap-feasibility";
import { pickCourseSwapSnap } from "@/lib/planner/course-swap-snap";
import {
  everyPlannerItemHasSolvePack,
  feasibleSinglePinChoicesForDrag,
} from "@/lib/planner/solve-schedules-core";
import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Ban, Minus, Pin, Redo2, Undo2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  usePlannerData,
  usePlannerHistory,
  usePlannerSolve,
  usePlannerUi,
} from "./PlannerContext";
import { usePlannerUndoRedoShortcuts } from "./usePlannerUndoRedoShortcuts";
import { BusyTimeDialog } from "./week-calendar/BusyTimeDialog";
import {
  buildFloatStyle,
  clientYToMinutes,
  DRAG_THRESHOLD_PX,
  formatQuarterHourLabel,
  scrollToId,
  SNAP_MAX_DIST_PX,
} from "./week-calendar/interaction";
import { ScheduleHelpDialog } from "./week-calendar/schedule-help-dialog";
import { WeekCalendarToolbar } from "./week-calendar/WeekCalendarToolbar";
import {
  groupBlackoutsByDay,
  groupSwapGhostsByDay,
} from "./week-calendar/group-by-day";
import { useViewportHourSizing } from "./week-calendar/use-viewport-hour-sizing";
import { useWeekViewportGestures } from "./week-calendar/use-week-viewport-gestures";
import {
  clearTextSelection,
  usePreventTextSelectionWhileDragging,
} from "./week-calendar/use-prevent-text-selection";
import { PLANNER_WEEK_VIEWPORT_HEIGHT } from "./week-calendar/constants";
import { visibleDayIndicesMerged } from "./week-calendar/visible-days";
import {
  applyCourseDragFloatStyle,
  courseDragSnapKey,
  type CourseDragSession,
} from "./week-calendar/course-drag";
import { WeekCalendarDayGhosts } from "./week-calendar/WeekCalendarDayGhosts";
import { WeekCalendarGrid } from "./week-calendar/WeekCalendarGrid";
import { WeekCalendarShell } from "./week-calendar/WeekCalendarShell";
import { ExportMenu } from "./ExportMenu";

type Props = {
  onBlockActivate: (block: CalendarBlock) => void;
};

const WEEK_VIEWPORT_STYLE = {
  height: PLANNER_WEEK_VIEWPORT_HEIGHT,
} as const;

export function WeekCalendar({ onBlockActivate }: Props) {
  const {
    catalog,
    plannerItems,
    mergedPackConstraintMaps,
    solvePacks,
    applyPlannerItemSelection,
    setSectionPinFromDrag,
    toggleSectionPin,
  } = usePlannerData();
  const {
    calendarBlocks: blocks,
    effectivePlannerItems,
    solutions,
    recalculateSolutions,
    isRecalculatingSolutions,
    hasAttemptedSolve,
    syncError,
    clearSyncError,
    scheduleFeasibilityError,
    clearScheduleFeasibilityError,
    infeasibilityHints,
  } = usePlannerSolve();
  const {
    blackouts,
    setBlackouts,
    requireOpenSections,
    setRequireOpenSections,
    excludeTba,
    excludeOnlineAsync,
  } = usePlannerUi();
  const { canUndo, canRedo, undo, redo } = usePlannerHistory();

  usePlannerUndoRedoShortcuts({ undo, redo, canUndo, canRedo });

  const plannerItemsById = useMemo(() => {
    const m = new Map<number, PlannerItemRow>();
    for (const r of plannerItems) m.set(r.id, r);
    return m;
  }, [plannerItems]);

  const [markBusyMode, setMarkBusyMode] = useState(false);
  const [busyDialogOpen, setBusyDialogOpen] = useState(false);
  const [editingBlackoutId, setEditingBlackoutId] = useState<string | null>(null);
  const [formDayIndex, setFormDayIndex] = useState(0);
  const [formStartMin, setFormStartMin] = useState(9 * 60);
  const [formEndMin, setFormEndMin] = useState(10 * 60);
  const [formLabel, setFormLabel] = useState("");
  const [dragPreview, setDragPreview] = useState<{
    dayIndex: number;
    topPx: number;
    heightPx: number;
  } | null>(null);
  const blackoutDragRef = useRef<{
    dayIndex: number;
    columnEl: HTMLElement;
    pointerId: number;
    startClientY: number;
    anchorMinutes: number;
  } | null>(null);

  const [swapError, setSwapError] = useState<string | null>(null);
  const [courseDragSession, setCourseDragSession] =
    useState<CourseDragSession | null>(null);
  const [isCourseDragging, setIsCourseDragging] = useState(false);
  const [, startSwapTransition] = useTransition();
  const dayStripRef = useRef<HTMLDivElement | null>(null);
  const courseDragGenRef = useRef(0);
  const courseDragActiveRef = useRef(false);
  const courseDragSessionRef = useRef<CourseDragSession | null>(null);
  const coursePointerDownRef = useRef<{
    block: CalendarBlock;
    clientX: number;
    clientY: number;
    pointerId: number;
  } | null>(null);
  const courseGrabOffsetRef = useRef({ dx: 0, dy: 0 });
  const capturedCourseBlockElRef = useRef<HTMLElement | null>(null);
  const lastCoursePointerRef = useRef({ x: 0, y: 0 });
  const dragFloatElRef = useRef<HTMLDivElement | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const dragSnapKeyRef = useRef<string | null>(null);

  useEffect(() => {
    courseDragSessionRef.current = courseDragSession;
  }, [courseDragSession]);

  const visibleDayIndices = useMemo(
    () => visibleDayIndicesMerged(blocks, blackouts.items),
    [blocks, blackouts.items],
  );
  const blackoutsByDay = useMemo(
    () => groupBlackoutsByDay(blackouts.items),
    [blackouts.items],
  );
  const ghostsByDay = useMemo(
    () =>
      groupSwapGhostsByDay(
        courseDragSession ? courseDragSession.ghosts : undefined,
      ),
    [courseDragSession],
  );
  const hScrollRef = useRef<HTMLDivElement | null>(null);
  const weekHeaderRef = useRef<HTMLDivElement | null>(null);

  const startMin = CALENDAR_START_HOUR * 60;
  const totalMin = CALENDAR_HOUR_COUNT * 60;
  const hourCount = CALENDAR_HOUR_COUNT;

  const {
    viewportRef,
    hourRowPx,
    setHourRowPx,
    hourRowPxRef,
    clampRowPx,
  } = useViewportHourSizing(hourCount);

  const rowPx = hourRowPx;
  const gridHeightPx = hourCount * rowPx;

  const scheduleDragFrame = useCallback((next: CourseDragSession) => {
    courseDragSessionRef.current = next;
    if (dragRafRef.current != null) return;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      const sess = courseDragSessionRef.current;
      if (!sess) return;
      applyCourseDragFloatStyle(dragFloatElRef.current, sess);
      const snapKey = courseDragSnapKey(sess.snapped);
      if (snapKey !== dragSnapKeyRef.current) {
        dragSnapKeyRef.current = snapKey;
        setCourseDragSession(sess);
      }
    });
  }, []);

  const endCourseDrag = useCallback(() => {
    courseDragGenRef.current += 1;
    courseDragActiveRef.current = false;
    courseDragSessionRef.current = null;
    coursePointerDownRef.current = null;
    capturedCourseBlockElRef.current = null;
    dragSnapKeyRef.current = null;
    if (dragRafRef.current != null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    setCourseDragSession(null);
    setIsCourseDragging(false);
  }, []);

  usePreventTextSelectionWhileDragging(isCourseDragging);

  const finalizeCourseDragSession = useCallback(
    (s: Omit<CourseDragSession, "floatStyle">): CourseDragSession => ({
      ...s,
      floatStyle: buildFloatStyle(
        dayStripRef.current,
        s,
        gridHeightPx,
        startMin,
        totalMin,
        visibleDayIndices,
      ),
    }),
    [gridHeightPx, startMin, totalMin, visibleDayIndices],
  );

  const pickCourseSnap = useCallback(
    (
      clientX: number,
      clientY: number,
      ghosts: SwapGhostMeeting[],
      sourceBlock: CalendarBlock,
    ) => {
      const strip = dayStripRef.current;
      if (!strip) return null;
      return pickCourseSwapSnap(
        clientX,
        clientY,
        ghosts,
        sourceBlock,
        strip,
        gridHeightPx,
        startMin,
        totalMin,
        visibleDayIndices,
        SNAP_MAX_DIST_PX,
      );
    },
    [gridHeightPx, startMin, totalMin, visibleDayIndices],
  );

  useWeekViewportGestures({
    viewportRef,
    weekHeaderRef,
    hScrollRef,
    hourRowPxRef,
    clampRowPx,
    setHourRowPx,
    endCourseDrag,
    courseDragSessionRef,
    coursePointerDownRef,
    capturedCourseBlockElRef,
  });

  const timeQuarterOptions = useMemo(() => {
    const out: { value: number; label: string }[] = [];
    for (let h = CALENDAR_START_HOUR; h <= CALENDAR_END_HOUR; h++) {
      for (const q of [0, 15, 30, 45]) {
        const m = h * 60 + q;
        if (m >= (CALENDAR_END_HOUR + 1) * 60) break;
        out.push({ value: m, label: formatQuarterHourLabel(m) });
      }
    }
    return out;
  }, []);

  const openEditBlackout = useCallback((item: PlannerBlackoutItemV1) => {
    setEditingBlackoutId(item.id);
    setFormDayIndex(item.dayIndex);
    setFormStartMin(item.start);
    setFormEndMin(item.end);
    setFormLabel(item.label ?? "");
    setBusyDialogOpen(true);
  }, []);

  // Reset transient form state on close so the next time the dialog opens
  // we don't briefly flash the previous edit's day/time/label values
  // before the parent assigns fresh ones (or before an Escape/overlay
  // close leaks the stale `editingBlackoutId`).
  const handleBusyDialogOpenChange = useCallback((next: boolean) => {
    setBusyDialogOpen(next);
    if (!next) {
      setEditingBlackoutId(null);
      setFormLabel("");
    }
  }, []);

  const commitBusyForm = useCallback(() => {
    if (!editingBlackoutId) {
      handleBusyDialogOpenChange(false);
      return;
    }
    const body = clampInterval({
      dayIndex: formDayIndex,
      start: formStartMin,
      end: formEndMin,
      label: formLabel.trim() || undefined,
    });
    if (body.end - body.start < 30) {
      handleBusyDialogOpenChange(false);
      return;
    }
    const next: PlannerBlackoutItemV1 = {
      id: editingBlackoutId,
      dayIndex: body.dayIndex,
      start: body.start,
      end: body.end,
      label: body.label,
    };
    setBlackouts((prev) => ({
      v: 1,
      items: prev.items.map((i) => (i.id === editingBlackoutId ? next : i)),
    }));
    track("planner_blackout_edited", {
      dayIndex: next.dayIndex,
      minutes: next.end - next.start,
    });
    handleBusyDialogOpenChange(false);
  }, [
    editingBlackoutId,
    formDayIndex,
    formEndMin,
    formLabel,
    formStartMin,
    handleBusyDialogOpenChange,
    setBlackouts,
  ]);

  const removeEditingBlackout = useCallback(() => {
    if (!editingBlackoutId) return;
    setBlackouts((prev) => ({
      v: 1,
      items: prev.items.filter((i) => i.id !== editingBlackoutId),
    }));
    track("planner_blackout_removed", {});
    handleBusyDialogOpenChange(false);
  }, [editingBlackoutId, handleBusyDialogOpenChange, setBlackouts]);

  const endDragToBlackout = useCallback(
    (clientY: number) => {
      const sess = blackoutDragRef.current;
      if (!sess) return;
      const rawEnd = clientYToMinutes(
        clientY,
        sess.columnEl,
        gridHeightPx,
        startMin,
        totalMin,
      );
      let a = Math.min(sess.anchorMinutes, rawEnd);
      let b = Math.max(sess.anchorMinutes, rawEnd);
      const snapped = snapIntervalEndpoints(a, b);
      a = snapped.start;
      b = snapped.end;
      let body = clampInterval({
        dayIndex: sess.dayIndex,
        start: a,
        end: b,
        label: undefined,
      });
      if (body.end - body.start < 30) {
        body = clampInterval({
          dayIndex: sess.dayIndex,
          start: body.start,
          end: body.start + 30,
          label: undefined,
        });
      }
      blackoutDragRef.current = null;
      setDragPreview(null);
      if (body.end - body.start < 30) return;
      const id =
        globalThis.crypto?.randomUUID?.() ?? `b${Date.now().toString(36)}`;
      setBlackouts((prev) => ({
        v: 1,
        items: [
          ...prev.items,
          {
            id,
            dayIndex: body.dayIndex,
            start: body.start,
            end: body.end,
          },
        ],
      }));
      track("planner_blackout_added", {
        dayIndex: body.dayIndex,
        minutes: body.end - body.start,
      });
    },
    [gridHeightPx, setBlackouts, startMin, totalMin],
  );

  const onDayColumnPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, dayIndex: number) => {
      if (!markBusyMode || e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      const col = e.currentTarget as HTMLElement;
      try {
        col.setPointerCapture(e.pointerId);
      } catch {
        return;
      }
      const anchor = clientYToMinutes(
        e.clientY,
        col,
        gridHeightPx,
        startMin,
        totalMin,
      );
      blackoutDragRef.current = {
        dayIndex,
        columnEl: col,
        pointerId: e.pointerId,
        startClientY: e.clientY,
        anchorMinutes: anchor,
      };
    },
    [gridHeightPx, markBusyMode, startMin, totalMin],
  );

  const onDayColumnPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const sess = blackoutDragRef.current;
      if (!sess || e.pointerId !== sess.pointerId) return;
      const rawEnd = clientYToMinutes(
        e.clientY,
        sess.columnEl,
        gridHeightPx,
        startMin,
        totalMin,
      );
      let a = Math.min(sess.anchorMinutes, rawEnd);
      let b = Math.max(sess.anchorMinutes, rawEnd);
      const snapped = snapIntervalEndpoints(a, b);
      a = snapped.start;
      b = snapped.end;
      const topPx = ((a - startMin) / totalMin) * gridHeightPx;
      const heightPx = Math.max(4, ((b - a) / totalMin) * gridHeightPx);
      setDragPreview({ dayIndex: sess.dayIndex, topPx, heightPx });
    },
    [gridHeightPx, startMin, totalMin],
  );

  const onDayColumnPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const sess = blackoutDragRef.current;
      if (!sess || e.pointerId !== sess.pointerId) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      endDragToBlackout(e.clientY);
    },
    [endDragToBlackout],
  );

  const onDayColumnPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const sess = blackoutDragRef.current;
      if (!sess || e.pointerId !== sess.pointerId) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      blackoutDragRef.current = null;
      setDragPreview(null);
    },
    [],
  );

  const zoomCalendarIn = useCallback(() => {
    setHourRowPx((prev) => clampRowPx(prev * 1.08));
  }, [clampRowPx, setHourRowPx]);

  const zoomCalendarOut = useCallback(() => {
    setHourRowPx((prev) => clampRowPx(prev / 1.08));
  }, [clampRowPx, setHourRowPx]);

  const dayColumnClassName = useMemo(
    () => (markBusyMode ? "cursor-crosshair touch-manipulation" : undefined),
    [markBusyMode],
  );

  const dayColumnHandlers = useCallback(
    (dayIndex: number) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) =>
        onDayColumnPointerDown(e, dayIndex),
      onPointerMove: onDayColumnPointerMove,
      onPointerUp: onDayColumnPointerUp,
      onPointerCancel: onDayColumnPointerCancel,
    }),
    [
      onDayColumnPointerDown,
      onDayColumnPointerMove,
      onDayColumnPointerUp,
      onDayColumnPointerCancel,
    ],
  );

  const renderDayOverlay = useCallback(
    (dayIndex: number) => (
      <>
        {(blackoutsByDay.get(dayIndex) ?? []).map((bo) => {
          const topPx = ((bo.start - startMin) / totalMin) * gridHeightPx;
          const rawH = ((bo.end - bo.start) / totalMin) * gridHeightPx;
          const heightPx = Math.max(8, rawH);
          const title =
            bo.label?.trim() ||
            `Busy ${formatQuarterHourLabel(bo.start)}–${formatQuarterHourLabel(bo.end)}`;
          return (
            <button
              key={bo.id}
              type="button"
              title={title}
              aria-label={`Edit busy time: ${title}`}
              className={cn(
                "absolute left-0.5 right-0.5 z-[12] overflow-hidden rounded-md border border-dashed border-muted-foreground/45 bg-muted/55 text-left shadow-none",
                "bg-[repeating-linear-gradient(-52deg,transparent,transparent_5px,rgba(0,0,0,0.06)_5px,rgba(0,0,0,0.06)_6px)]",
              )}
              style={{
                top: topPx,
                height: heightPx,
                padding: "4px 6px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                openEditBlackout(bo);
              }}
            >
              <span className="line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">
                {bo.label?.trim() || "Busy"}
              </span>
            </button>
          );
        })}
        {dragPreview && dragPreview.dayIndex === dayIndex ? (
          <div
            className="pointer-events-none absolute left-0.5 right-0.5 z-[11] rounded-md border-2 border-dashed border-primary bg-primary/15"
            style={{
              top: dragPreview.topPx,
              height: dragPreview.heightPx,
            }}
            aria-hidden
          />
        ) : null}
        {courseDragSession ? (
          <WeekCalendarDayGhosts
            ghosts={ghostsByDay.get(dayIndex) ?? []}
            snapped={courseDragSession.snapped}
            startMin={startMin}
            totalMin={totalMin}
            gridHeightPx={gridHeightPx}
          />
        ) : null}
      </>
    ),
    [
      blackoutsByDay,
      startMin,
      totalMin,
      gridHeightPx,
      openEditBlackout,
      dragPreview,
      courseDragSession,
      ghostsByDay,
    ],
  );

  useEffect(() => {
    if (!courseDragSession) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") endCourseDrag();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [courseDragSession, endCourseDrag]);

  // Drag UX: pin-drag feasibility for an unresolved block's same-type swap
  // ghosts. Returns `undefined` when the dragged item isn't unresolved (no
  // additional filtering), `null` when packs are still loading (treat all as
  // feasible — re-checked on commit), or a Set of CRNs that produce a
  // complete schedule. Computed once per drag in a single batched DFS pass
  // rather than once per ghost CRN.
  const pinDragFeasiblePinnedCrnsForBlock = useCallback(
    (b: CalendarBlock, candidateCrns: readonly string[]): ReadonlySet<string> | null | undefined => {
      if (
        plannerItemsById.get(b.plannerItemId)?.selectionKind !==
        "unresolved"
      ) {
        return undefined;
      }
      const result = feasibleSinglePinChoicesForDrag(
        plannerItems,
        solvePacks,
        b.plannerItemId,
        b.sectionScheduleTypeKey,
        candidateCrns,
        {
          requireOpenSections,
          excludeTba,
          excludeOnlineAsync,
          blackoutIntervals: blackoutsDocToTimeIntervals(blackouts),
        },
      );
      return result;
    },
    [
      plannerItems,
      plannerItemsById,
      solvePacks,
      requireOpenSections,
      excludeTba,
      excludeOnlineAsync,
      blackouts,
    ],
  );

  const onCourseBlockPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, block: CalendarBlock) => {
      if (e.button !== 0) return;
      setSwapError(null);
      clearScheduleFeasibilityError();
      const el = e.currentTarget;
      const br = el.getBoundingClientRect();
      courseGrabOffsetRef.current = {
        dx: e.clientX - br.left,
        dy: e.clientY - br.top,
      };
      coursePointerDownRef.current = {
        block,
        clientX: e.clientX,
        clientY: e.clientY,
        pointerId: e.pointerId,
      };
      // Pointer capture is best-effort; if the browser rejects it we still
      // fall back to global pointer events. Surfacing the error helps debug
      // unusual hardware/browser interactions instead of silently swallowing
      // the drag start.
      try {
        el.setPointerCapture(e.pointerId);
        capturedCourseBlockElRef.current = el;
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[planner] setPointerCapture failed; falling back to bubbled pointer events",
            err,
          );
        }
        capturedCourseBlockElRef.current = null;
      }
    },
    [clearScheduleFeasibilityError],
  );

  const onCourseBlockPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const down = coursePointerDownRef.current;
      if (!down || e.pointerId !== down.pointerId) return;

      lastCoursePointerRef.current = { x: e.clientX, y: e.clientY };

      const dx = e.clientX - down.clientX;
      const dy = e.clientY - down.clientY;
      const dist = Math.hypot(dx, dy);

      if (!courseDragActiveRef.current && dist >= DRAG_THRESHOLD_PX) {
        e.preventDefault();
        courseDragActiveRef.current = true;
        courseDragGenRef.current += 1;
        setIsCourseDragging(true);
        clearTextSelection();
        const b = down.block;
        const item = effectivePlannerItems.find((r) => r.id === b.plannerItemId);
        if (!item) {
          endCourseDrag();
          return;
        }
        const raw = listSameTypeSwapGhostsFromCatalog(catalog, {
          subject: b.subject,
          courseNumber: b.courseNumber,
          excludeSectionCrn: b.sectionCrn,
          sourceScheduleTypeKey: b.sectionScheduleTypeKey,
          sourceMeetingScheduleType: b.meetingScheduleType,
        });
        const candidateCrns: string[] = [];
        const seenCandidate = new Set<string>();
        for (const g of raw) {
          if (g.crn === b.sectionCrn) continue;
          if (seenCandidate.has(g.crn)) continue;
          seenCandidate.add(g.crn);
          candidateCrns.push(g.crn);
        }
        const ghosts = filterFeasibleSwapGhosts({
          catalog,
          draggedBlock: b,
          draggedPlannerItem: item,
          otherEffectiveItems: effectivePlannerItems,
          blackoutIntervals: blackoutsDocToTimeIntervals(blackouts),
          requireOpenSections,
          excludeTba,
          excludeOnlineAsync,
          seatsByCrn: mergedPackConstraintMaps.seatsByCrn,
          facultyByCrn: mergedPackConstraintMaps.facultyByCrn,
          scheduleTypeByCrn: mergedPackConstraintMaps.scheduleTypeByCrn,
          deliveryModeByCrn: mergedPackConstraintMaps.deliveryModeByCrn,
          rawGhosts: raw,
          pinDragFeasiblePinnedCrns: pinDragFeasiblePinnedCrnsForBlock(
            b,
            candidateCrns,
          ),
        });
        const snapped = pickCourseSnap(
          lastCoursePointerRef.current.x,
          lastCoursePointerRef.current.y,
          ghosts,
          b,
        );
        const next = finalizeCourseDragSession({
          block: b,
          pointerId: e.pointerId,
          clientX: e.clientX,
          clientY: e.clientY,
          grabDx: courseGrabOffsetRef.current.dx,
          grabDy: courseGrabOffsetRef.current.dy,
          ghosts,
          snapped,
        });
        dragSnapKeyRef.current = courseDragSnapKey(next.snapped);
        courseDragSessionRef.current = next;
        setCourseDragSession(next);
        applyCourseDragFloatStyle(dragFloatElRef.current, next);
        return;
      }

      if (courseDragActiveRef.current && e.pointerId === down.pointerId) {
        e.preventDefault();
        const sess = courseDragSessionRef.current;
        if (!sess) return;
        const snapped = pickCourseSnap(
          e.clientX,
          e.clientY,
          sess.ghosts,
          sess.block,
        );
        const next = finalizeCourseDragSession({
          block: sess.block,
          pointerId: sess.pointerId,
          clientX: e.clientX,
          clientY: e.clientY,
          grabDx: sess.grabDx,
          grabDy: sess.grabDy,
          ghosts: sess.ghosts,
          snapped,
        });
        scheduleDragFrame(next);
      }
    },
    [
      blackouts,
      catalog,
      effectivePlannerItems,
      endCourseDrag,
      finalizeCourseDragSession,
      mergedPackConstraintMaps.deliveryModeByCrn,
      mergedPackConstraintMaps.facultyByCrn,
      mergedPackConstraintMaps.scheduleTypeByCrn,
      mergedPackConstraintMaps.seatsByCrn,
      pickCourseSnap,
      pinDragFeasiblePinnedCrnsForBlock,
      scheduleDragFrame,
      requireOpenSections,
      excludeTba,
      excludeOnlineAsync,
    ],
  );

  const onCourseBlockPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const down = coursePointerDownRef.current;
      if (!down || e.pointerId !== down.pointerId) return;

      const dx = e.clientX - down.clientX;
      const dy = e.clientY - down.clientY;
      const dist = Math.hypot(dx, dy);

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const session = courseDragSessionRef.current;
      const wasDrag = courseDragActiveRef.current;

      coursePointerDownRef.current = null;
      capturedCourseBlockElRef.current = null;

      if (wasDrag && session && e.pointerId === session.pointerId) {
        const { snapped, block } = session;
        if (snapped && snapped.crn !== block.sectionCrn) {
          endCourseDrag();
          const baseItem = plannerItemsById.get(block.plannerItemId);
          const item = effectivePlannerItems.find(
            (r) => r.id === block.plannerItemId,
          );
          if (!item || !baseItem) return;
          startSwapTransition(() => {
            const res = resolvePlannerSwapClient(item, {
              targetCrn: snapped.crn,
              sourceSectionCrn: block.sectionCrn,
              sourceMeetingId: block.meetingId,
            }, catalog);
            if (!res.ok) {
              setSwapError(res.error);
              return;
            }
            if (baseItem.selectionKind === "unresolved") {
              setSectionPinFromDrag(
                block.plannerItemId,
                block.sectionScheduleTypeKey,
                snapped.crn,
              );
            } else {
              applyPlannerItemSelection(block.plannerItemId, {
                selectionKind: res.selectionKind,
                anchorCrn: res.anchorCrn,
                linkedBundleId: res.linkedBundleId,
              });
            }
          });
          return;
        }
        endCourseDrag();
        return;
      }

      if (dist < DRAG_THRESHOLD_PX) {
        onBlockActivate(down.block);
      }
    },
    [
      applyPlannerItemSelection,
      catalog,
      effectivePlannerItems,
      plannerItemsById,
      setSectionPinFromDrag,
      endCourseDrag,
      onBlockActivate,
    ],
  );

  const onCourseBlockPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (coursePointerDownRef.current?.pointerId !== e.pointerId) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      coursePointerDownRef.current = null;
      endCourseDrag();
    },
    [endCourseDrag],
  );

  const blockHandlers = useCallback(
    (b: CalendarBlock) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) =>
        onCourseBlockPointerDown(e, b),
      onPointerMove: onCourseBlockPointerMove,
      onPointerUp: onCourseBlockPointerUp,
      onPointerCancel: onCourseBlockPointerCancel,
      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onBlockActivate(b);
        }
      },
    }),
    [
      onCourseBlockPointerDown,
      onCourseBlockPointerMove,
      onCourseBlockPointerUp,
      onCourseBlockPointerCancel,
      onBlockActivate,
    ],
  );

  const blockClassName = useCallback(
    (b: CalendarBlock) => {
      const dimSource =
        !!courseDragSession &&
        courseDragSession.block.key === b.key &&
        (courseDragSession.ghosts.length > 0 ||
          courseDragSession.snapped != null);
      return dimSource ? "opacity-35" : undefined;
    },
    [courseDragSession],
  );

  const renderBlockOverlay = useCallback(
    (b: CalendarBlock) => {
      const rowItem = plannerItemsById.get(b.plannerItemId);
      if (rowItem?.selectionKind !== "unresolved") return null;
      const pinsDoc = parseSectionPinsJson(rowItem.sectionPins);
      const isPinnedThisBlock =
        pinsDoc.byType[b.sectionScheduleTypeKey] === b.sectionCrn;
      return (
        <span
          className="pointer-events-auto absolute right-0.5 top-0.5 z-30"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-6 touch-manipulation shadow-sm"
            aria-label={
              isPinnedThisBlock
                ? `Unpin this ${b.subject} ${b.courseNumber} meeting`
                : `Pin this ${b.subject} ${b.courseNumber} meeting`
            }
            title={
              isPinnedThisBlock
                ? "Unpin (same button)"
                : "Pin this meeting type"
            }
            onClick={(e) => {
              e.stopPropagation();
              toggleSectionPin(
                b.plannerItemId,
                b.sectionScheduleTypeKey,
                b.sectionCrn,
              );
            }}
          >
            <Pin
              className={cn(
                "size-3.5",
                isPinnedThisBlock && "fill-primary text-primary",
              )}
              aria-hidden
            />
          </Button>
        </span>
      );
    },
    [plannerItemsById, toggleSectionPin],
  );

  const showNoSchedulesHelp =
    hasAttemptedSolve &&
    !isRecalculatingSolutions &&
    solutions.length === 0 &&
    plannerItems.length > 0 &&
    everyPlannerItemHasSolvePack(plannerItems, solvePacks);
  const busyCount = blackouts.items.length;

  return (
    <WeekCalendarShell
      isDragging={isCourseDragging}
      syncError={syncError}
      onClearSyncError={clearSyncError}
      scheduleFeasibilityError={scheduleFeasibilityError}
      onClearScheduleFeasibilityError={clearScheduleFeasibilityError}
      swapError={swapError}
      onClearSwapError={() => setSwapError(null)}
      isRecalculatingSolutions={isRecalculatingSolutions}
      toolbar={
        <WeekCalendarToolbar
          plannerItemCount={plannerItems.length}
          meta={<CreditHoursPill />}
          exportSlot={<ExportMenu />}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 touch-manipulation"
                aria-label="Undo"
                title="Undo (⌘Z)"
                disabled={!canUndo}
                onClick={undo}
              >
                <Undo2 className="size-4" aria-hidden />
                <span className="ml-1.5 hidden sm:inline">Undo</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 touch-manipulation"
                aria-label="Redo"
                title="Redo (⇧⌘Z)"
                disabled={!canRedo}
                onClick={redo}
              >
                <Redo2 className="size-4" aria-hidden />
                <span className="ml-1.5 hidden sm:inline">Redo</span>
              </Button>
              <Button
                type="button"
                variant={markBusyMode ? "default" : "outline"}
                size="sm"
                className="h-9 touch-manipulation"
                aria-pressed={markBusyMode}
                aria-label={
                  markBusyMode ? "Stop marking busy time" : "Mark busy time"
                }
                onClick={() => {
                  setMarkBusyMode((v) => !v);
                  blackoutDragRef.current = null;
                  setDragPreview(null);
                }}
              >
                <Ban className="size-4" aria-hidden />
                <span className="ml-1.5 hidden sm:inline">Mark busy time</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="touch-manipulation"
                aria-label="Zoom week view out"
                onClick={zoomCalendarOut}
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="touch-manipulation"
                aria-label="Zoom week view in"
                onClick={zoomCalendarIn}
              >
                <ZoomIn className="size-4" aria-hidden />
              </Button>
              <ScheduleHelpDialog />
            </>
          }
        />
      }
      noSchedulesHelp={showNoSchedulesHelp ? (
        <div className="border-b border-border bg-muted/20 p-3 sm:p-4">
          {infeasibilityHints.length > 0 ? (
            <ul className="mb-3 list-inside list-disc space-y-2 text-sm text-foreground">
              {infeasibilityHints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
          <p className="font-medium text-foreground">No schedule fits yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try one of these to open up the week:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-2 text-sm text-foreground">
            {requireOpenSections ? (
              <li>
                <button
                  type="button"
                  className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                  onClick={() => {
                    setRequireOpenSections(false);
                    void recalculateSolutions({ requireOpenSections: false });
                    document.getElementById("exclude-full-toggle")?.focus();
                  }}
                >
                  Turn off “Exclude full”
                </button>
                <span className="text-muted-foreground">
                  {" "}
                  (then turn it on again if you need open seats only).
                </span>
              </li>
            ) : (
              <li>
                <button
                  type="button"
                  className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                  onClick={() =>
                    document.getElementById("exclude-full-toggle")?.focus()
                  }
                >
                  Try “Exclude full”
                </button>
                <span className="text-muted-foreground">
                  {" "}
                  if you want only open seats.
                </span>
              </li>
            )}
            {busyCount > 0 ? (
              <li>
                <button
                  type="button"
                  className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                  onClick={() => scrollToId("planner-week-calendar-toolbar")}
                >
                  Edit or remove busy times
                </button>
                <span className="text-muted-foreground">
                  {" "}
                  ({busyCount} on your calendar)
                </span>
                {" · "}
                <button
                  type="button"
                  className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                  onClick={() => {
                    track("planner_blackouts_cleared", {
                      count: blackouts.items.length,
                    });
                    setBlackouts({ v: 1, items: [] });
                  }}
                >
                  Clear all busy times
                </button>
              </li>
            ) : (
              <li>
                <button
                  type="button"
                  className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                  onClick={() => scrollToId("planner-week-calendar-toolbar")}
                >
                  Mark busy times
                </button>
                <span className="text-muted-foreground">
                  {" "}
                  on the week (toolbar) if something should stay free.
                </span>
              </li>
            )}
            <li>
              <button
                type="button"
                className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                onClick={() => scrollToId("planner-courses")}
              >
                Relax instructor choices
              </button>
              <span className="text-muted-foreground">
                {" "}
                (pick “Any” or expand Advanced for labs/discussions).
              </span>
            </li>
            <li>
              <button
                type="button"
                className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                onClick={() => scrollToId("planner-courses")}
              >
                Remove a course
              </button>
              <span className="text-muted-foreground">
                {" "}
                if you added more than you need this term.
              </span>
            </li>
          </ul>
        </div>
      ) : null}
    >
      <WeekCalendarGrid
        hScrollRef={hScrollRef}
        courseDragSession={courseDragSession}
        dragFloatRef={dragFloatElRef}
        blocks={blocks}
        visibleDayIndices={visibleDayIndices}
        rowPx={rowPx}
        weekHeaderRef={weekHeaderRef}
        viewportRef={viewportRef}
        dayStripRef={dayStripRef}
        viewportStyle={WEEK_VIEWPORT_STYLE}
        dayColumnClassName={dayColumnClassName}
        dayColumnHandlers={dayColumnHandlers}
        renderDayOverlay={renderDayOverlay}
        blockHandlers={blockHandlers}
        blockClassName={blockClassName}
        renderBlockOverlay={renderBlockOverlay}
      />

      <BusyTimeDialog
        open={busyDialogOpen}
        onOpenChange={handleBusyDialogOpenChange}
        editingId={editingBlackoutId}
        dayIndex={formDayIndex}
        startMin={formStartMin}
        endMin={formEndMin}
        label={formLabel}
        timeOptions={timeQuarterOptions}
        onDayChange={setFormDayIndex}
        onStartChange={setFormStartMin}
        onEndChange={setFormEndMin}
        onLabelChange={setFormLabel}
        onRemove={removeEditingBlackout}
        onCancel={() => handleBusyDialogOpenChange(false)}
        onSave={commitBusyForm}
      />
    </WeekCalendarShell>
  );
}

function CreditHoursPill() {
  const { catalog } = usePlannerData();
  const { effectivePlannerItems, calendarBlocks } = usePlannerSolve();
  const total = useMemo(() => {
    if (effectivePlannerItems.length === 0) return 0;
    const sectionByCrn = new Map<string, number | null>();
    for (const s of catalog.sections) sectionByCrn.set(s.crn, s.creditHours);
    const anchorCrnByItemId = new Map<number, string>();
    for (const item of effectivePlannerItems) {
      if (item.anchorCrn) anchorCrnByItemId.set(item.id, item.anchorCrn);
    }
    // Fall back to the first calendar block's section CRN when no anchor is
    // resolved yet — this gives users a credit estimate while the planner
    // is still picking sections.
    const seenItems = new Set<number>();
    let sum = 0;
    for (const item of effectivePlannerItems) {
      if (seenItems.has(item.id)) continue;
      seenItems.add(item.id);
      const anchorCrn = anchorCrnByItemId.get(item.id);
      if (anchorCrn) {
        const ch = sectionByCrn.get(anchorCrn);
        if (typeof ch === "number" && Number.isFinite(ch)) sum += ch;
        continue;
      }
      const block = calendarBlocks.find((b) => b.plannerItemId === item.id);
      if (!block) continue;
      const ch = sectionByCrn.get(block.sectionCrn);
      if (typeof ch === "number" && Number.isFinite(ch)) sum += ch;
    }
    return sum;
  }, [effectivePlannerItems, calendarBlocks, catalog.sections]);

  if (total <= 0) return null;
  const isFullTime = total >= 12;
  const display = Number.isInteger(total) ? `${total}` : total.toFixed(1);
  const label = `${display} credit hour${total === 1 ? "" : "s"}`;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium",
        isFullTime
          ? "border-amber-500/40 bg-amber-100/70 text-amber-900"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
      title={
        isFullTime
          ? `${label} · full-time (UW undergrad threshold is 12)`
          : `${label} · part-time (full-time at 12)`
      }
      aria-label={label}
    >
      <span className="font-mono tabular-nums">{display}</span>
      <span>cr</span>
      {isFullTime ? <span className="ml-0.5">· full-time</span> : null}
    </span>
  );
}

