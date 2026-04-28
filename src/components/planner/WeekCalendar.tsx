"use client";

import {
  collectDisplayCrnsForItems,
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
  feasibleSinglePinChoicesForDrag,
} from "@/lib/planner/solve-schedules-core";
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
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  Minus,
  Pin,
  X,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanner } from "./PlannerContext";
import { BusyTimeDialog } from "./week-calendar/BusyTimeDialog";
import {
  buildFloatStyle,
  clientYToMinutes,
  DRAG_THRESHOLD_PX,
  formatQuarterHourLabel,
  scrollToId,
  SNAP_MAX_DIST_PX,
} from "./week-calendar/interaction";
import {
  GESTURE_TIP_STORAGE_KEY,
  ScheduleHelpDialog,
} from "./week-calendar/schedule-help-dialog";
import {
  groupBlackoutsByDay,
  groupSwapGhostsByDay,
} from "./week-calendar/group-by-day";
import { useViewportHourSizing } from "./week-calendar/use-viewport-hour-sizing";
import { useWeekViewportGestures } from "./week-calendar/use-week-viewport-gestures";
import { visibleDayIndicesMerged } from "./week-calendar/visible-days";
import { WeekCalendarView } from "./week-calendar/WeekCalendarView";

type Props = {
  onBlockActivate: (block: CalendarBlock) => void;
};

type DragSessionState = {
  block: CalendarBlock;
  pointerId: number;
  clientX: number;
  clientY: number;
  grabDx: number;
  grabDy: number;
  ghosts: SwapGhostMeeting[];
  snapped: SwapGhostMeeting | null;
  floatStyle: { left: number; top: number; width: number; height: number };
};

export function WeekCalendar({ onBlockActivate }: Props) {
  const {
    calendarBlocks: blocks,
    blackouts,
    setBlackouts,
    catalog,
    plannerItems,
    effectivePlannerItems,
    solutions,
    requireOpenSections,
    setRequireOpenSections,
    recalculateSolutions,
    isRecalculatingSolutions,
    syncError,
    clearSyncError,
    scheduleFeasibilityError,
    clearScheduleFeasibilityError,
    solvePacks,
    infeasibilityHints,
    mergedPackConstraintMaps,
    applyPlannerItemSelection,
    setSectionPinFromDrag,
    toggleSectionPin,
  } = usePlanner();

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
  const [showGestureTip, setShowGestureTip] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(GESTURE_TIP_STORAGE_KEY)) {
        queueMicrotask(() => setShowGestureTip(true));
      }
    } catch {
      /* private mode or blocked */
    }
  }, []);
  const blackoutDragRef = useRef<{
    dayIndex: number;
    columnEl: HTMLElement;
    pointerId: number;
    startClientY: number;
    anchorMinutes: number;
  } | null>(null);

  const [copyStatus, setCopyStatus] = useState<"idle" | "ok" | "err">("idle");
  const copyStatusTimerRef = useRef<number | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [courseDragSession, setCourseDragSession] =
    useState<DragSessionState | null>(null);
  const [, startSwapTransition] = useTransition();
  const dayStripRef = useRef<HTMLDivElement | null>(null);
  const courseDragGenRef = useRef(0);
  const courseDragActiveRef = useRef(false);
  const courseDragSessionRef = useRef<DragSessionState | null>(null);
  const coursePointerDownRef = useRef<{
    block: CalendarBlock;
    clientX: number;
    clientY: number;
    pointerId: number;
  } | null>(null);
  const courseGrabOffsetRef = useRef({ dx: 0, dy: 0 });
  const capturedCourseBlockElRef = useRef<HTMLElement | null>(null);
  const lastCoursePointerRef = useRef({ x: 0, y: 0 });

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
  const isWeekdaysOnlyView = visibleDayIndices.length === 5;
  const gridMinWidthRem =
    visibleDayIndices.length === 7
      ? 40.5
      : 3.5 + visibleDayIndices.length * 4.5;

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
    minRowPx,
  } = useViewportHourSizing(hourCount);

  const rowPx = hourRowPx ?? Math.max(44, minRowPx);
  const gridHeightPx = hourCount * rowPx;

  const endCourseDrag = useCallback(() => {
    courseDragGenRef.current += 1;
    courseDragActiveRef.current = false;
    courseDragSessionRef.current = null;
    coursePointerDownRef.current = null;
    capturedCourseBlockElRef.current = null;
    setCourseDragSession(null);
  }, []);

  const finalizeCourseDragSession = useCallback(
    (s: Omit<DragSessionState, "floatStyle">): DragSessionState => ({
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

  useEffect(() => {
    return () => {
      if (copyStatusTimerRef.current) {
        clearTimeout(copyStatusTimerRef.current);
        copyStatusTimerRef.current = null;
      }
    };
  }, []);

  const zoomCalendarIn = useCallback(() => {
    setHourRowPx((prev) => clampRowPx((prev ?? minRowPx) * 1.08));
  }, [clampRowPx, minRowPx, setHourRowPx]);

  const zoomCalendarOut = useCallback(() => {
    setHourRowPx((prev) => clampRowPx((prev ?? minRowPx) / 1.08));
  }, [clampRowPx, minRowPx, setHourRowPx]);

  const displayWeekCrns = useMemo(
    () => collectDisplayCrnsForItems(effectivePlannerItems, catalog),
    [effectivePlannerItems, catalog],
  );

  const copyCrns = useCallback(async () => {
    if (displayWeekCrns.length === 0) return;
    if (copyStatusTimerRef.current) {
      clearTimeout(copyStatusTimerRef.current);
      copyStatusTimerRef.current = null;
    }
    try {
      await navigator.clipboard.writeText(displayWeekCrns.join("\n"));
      setCopyStatus("ok");
      copyStatusTimerRef.current = window.setTimeout(() => {
        copyStatusTimerRef.current = null;
        setCopyStatus("idle");
      }, 2000);
    } catch {
      setCopyStatus("err");
      copyStatusTimerRef.current = window.setTimeout(() => {
        copyStatusTimerRef.current = null;
        setCopyStatus("idle");
      }, 2500);
    }
  }, [displayWeekCrns]);

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
          blackoutIntervals: blackoutsDocToTimeIntervals(blackouts),
        },
      );
      return result;
    },
    [plannerItems, plannerItemsById, solvePacks, requireOpenSections, blackouts],
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
          seatsByCrn: mergedPackConstraintMaps.seatsByCrn,
          facultyByCrn: mergedPackConstraintMaps.facultyByCrn,
          scheduleTypeByCrn: mergedPackConstraintMaps.scheduleTypeByCrn,
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
        courseDragSessionRef.current = next;
        setCourseDragSession(next);
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
        courseDragSessionRef.current = next;
        setCourseDragSession(next);
      }
    },
    [
      blackouts,
      catalog,
      effectivePlannerItems,
      endCourseDrag,
      finalizeCourseDragSession,
      mergedPackConstraintMaps.facultyByCrn,
      mergedPackConstraintMaps.scheduleTypeByCrn,
      mergedPackConstraintMaps.seatsByCrn,
      pickCourseSnap,
      pinDragFeasiblePinnedCrnsForBlock,
      requireOpenSections,
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

  const showNoSchedulesHelp =
    solutions.length === 0 && plannerItems.length > 0;
  const busyCount = blackouts.items.length;

  return (
    <section
      id="planner-week-calendar"
      className={cn(
        "scroll-mt-20 min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        courseDragSession && "select-none",
      )}
      aria-labelledby="planner-week-calendar-heading"
    >
      {isWeekdaysOnlyView ? (
        <p className="sr-only">
          Showing Monday through Friday. Saturday or Sunday columns appear when
          a selected course or busy time uses that day.
        </p>
      ) : null}
      <div className="border-b border-border p-3 sm:p-4" id="planner-week-calendar-toolbar">
        {showGestureTip ? (
          <div className="mb-3 flex gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            <p className="min-w-0 flex-1 leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Tip:</span> On touch,
              use two fingers to pan the week; pinch to zoom. On a trackpad or
              mouse, hold <kbd className="rounded border border-border bg-background px-1 font-mono text-xs">Ctrl</kbd>{" "}
              and scroll to zoom — or use + / − beside the help button.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label="Dismiss tip"
              onClick={() => {
                try {
                  localStorage.setItem(GESTURE_TIP_STORAGE_KEY, "1");
                } catch {
                  /* ignore */
                }
                setShowGestureTip(false);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : null}
        {syncError ? (
          <div
            className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {syncError}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => clearSyncError()}
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {scheduleFeasibilityError ? (
          <div
            className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {scheduleFeasibilityError}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => clearScheduleFeasibilityError()}
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {isRecalculatingSolutions ? (
          <p
            className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"
            aria-live="polite"
          >
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            Finding the best week…
          </p>
        ) : null}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-3">
          <h2
            id="planner-week-calendar-heading"
            className="font-heading min-w-0 text-lg font-medium text-foreground"
          >
            Weekly schedule
          </h2>
          <div className="flex w-full min-w-0 flex-1 flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-x-3 md:gap-y-2">
            <div className="flex min-w-0 w-full flex-wrap items-center gap-2 md:w-auto">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-9 touch-manipulation"
                disabled={displayWeekCrns.length === 0}
                onClick={() => void copyCrns()}
              >
                <Copy className="mr-1.5 size-4 shrink-0" aria-hidden />
                Copy CRNs
              </Button>
              {copyStatus === "ok" ? (
                <span
                  className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
                  aria-live="polite"
                >
                  <Check
                    className="size-3.5 shrink-0 text-primary"
                    aria-hidden
                    strokeWidth={2.5}
                  />
                  Copied
                </span>
              ) : null}
              {copyStatus === "err" ? (
                <span
                  className="inline-flex min-w-0 items-center gap-1.5 text-xs text-destructive"
                  aria-live="polite"
                >
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                  Copy failed
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 w-full flex-wrap items-center gap-2 md:w-auto">
              <Button
                type="button"
                variant={requireOpenSections ? "default" : "outline"}
                size="lg"
                className="h-9 touch-manipulation"
                id="exclude-full-toggle"
                aria-pressed={requireOpenSections}
                onClick={() => {
                  const next = !requireOpenSections;
                  setRequireOpenSections(next);
                  void recalculateSolutions(next);
                }}
              >
                Exclude full
              </Button>
            </div>
            <div className="flex min-w-0 w-full flex-wrap items-center gap-2 md:w-auto">
              <Button
                type="button"
                variant={markBusyMode ? "default" : "outline"}
                size="lg"
                className="h-9 touch-manipulation"
                aria-pressed={markBusyMode}
                onClick={() => {
                  setMarkBusyMode((v) => !v);
                  blackoutDragRef.current = null;
                  setDragPreview(null);
                }}
              >
                Mark busy time
              </Button>
            </div>
            <div className="flex min-w-0 w-full flex-wrap items-center gap-1 md:w-auto">
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
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Copy CRNs lists every CRN shown on your calendar this week (the current
          best-fit schedule, including any slices you pinned).
        </p>
      </div>

      {showNoSchedulesHelp ? (
        <div className="border-b border-border bg-muted/20 p-3 sm:p-4">
          {infeasibilityHints.length > 0 ? (
            <ul className="mb-3 list-inside list-disc space-y-2 text-sm text-foreground">
              {infeasibilityHints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
          <p className="font-medium text-foreground">Nothing fits yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try one of these to make the week valid:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-2 text-sm text-foreground">
            {requireOpenSections ? (
              <li>
                <button
                  type="button"
                  className="text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground"
                  onClick={() => {
                    setRequireOpenSections(false);
                    void recalculateSolutions(false);
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
                  onClick={() => setBlackouts({ v: 1, items: [] })}
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

      {swapError ? (
        <div
          className="border-b border-border px-3 py-2.5 text-xs text-destructive sm:px-4"
          role="alert"
        >
          {swapError}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setSwapError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div ref={hScrollRef} className="overflow-x-auto">
        <WeekCalendarView
          blocks={blocks}
          visibleDayIndices={visibleDayIndices}
          rowPx={rowPx}
          gridMinWidthRem={gridMinWidthRem}
          weekHeaderRef={weekHeaderRef}
          viewportRef={viewportRef}
          dayStripRef={dayStripRef}
          viewportStyle={{ height: "min(72vh, 40rem)" }}
          dayColumnClassName={
            markBusyMode ? "cursor-crosshair touch-manipulation" : undefined
          }
          dayColumnHandlers={(dayIndex) => ({
            onPointerDown: (e) => onDayColumnPointerDown(e, dayIndex),
            onPointerMove: onDayColumnPointerMove,
            onPointerUp: onDayColumnPointerUp,
            onPointerCancel: onDayColumnPointerCancel,
          })}
          renderDayOverlay={(dayIndex) => (
            <>
              {(blackoutsByDay.get(dayIndex) ?? []).map((bo) => {
                const topPx =
                  ((bo.start - startMin) / totalMin) * gridHeightPx;
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
                      "bg-[repeating-linear-gradient(-52deg,transparent,transparent_5px,rgba(0,0,0,0.06)_5px,rgba(0,0,0,0.06)_6px)] dark:bg-[repeating-linear-gradient(-52deg,transparent,transparent_5px,rgba(255,255,255,0.06)_5px,rgba(255,255,255,0.06)_6px)]",
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
              {courseDragSession
                ? (ghostsByDay.get(dayIndex) ?? []).map((g) => {
                    const topPx =
                      ((g.startMinutes - startMin) / totalMin) * gridHeightPx;
                    const rawH =
                      ((g.endMinutes - g.startMinutes) / totalMin) *
                      gridHeightPx;
                    const heightPx = Math.max(8, rawH);
                    const sn = courseDragSession.snapped;
                    const isSnap =
                      !!sn &&
                      sn.crn === g.crn &&
                      sn.meetingId === g.meetingId &&
                      sn.dayIndex === g.dayIndex &&
                      sn.startMinutes === g.startMinutes &&
                      sn.endMinutes === g.endMinutes;
                    return (
                      <div
                        key={`ghost-${g.crn}-${g.meetingId}-${g.dayIndex}-${g.startMinutes}`}
                        className={cn(
                          "pointer-events-none absolute left-0.5 right-0.5 z-[30] rounded-md border border-dashed border-muted-foreground/50 bg-muted/25",
                          isSnap &&
                            "border-primary/70 bg-primary/10 ring-1 ring-primary/40",
                        )}
                        style={{ top: topPx, height: heightPx }}
                        aria-hidden
                      />
                    );
                  })
                : null}
            </>
          )}
          blockHandlers={(b) => ({
            onPointerDown: (e) => onCourseBlockPointerDown(e, b),
            onPointerMove: onCourseBlockPointerMove,
            onPointerUp: onCourseBlockPointerUp,
            onPointerCancel: onCourseBlockPointerCancel,
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onBlockActivate(b);
              }
            },
          })}
          blockClassName={(b) => {
            const dimSource =
              !!courseDragSession &&
              courseDragSession.block.key === b.key &&
              (courseDragSession.ghosts.length > 0 ||
                courseDragSession.snapped != null);
            return dimSource ? "opacity-35" : undefined;
          }}
          renderBlockOverlay={(b) => {
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
          }}
          viewportFloatingOverlay={
            courseDragSession ? (
              <div
                className="pointer-events-none fixed z-[60] overflow-hidden rounded-md border border-border bg-card/95 py-1.5 pr-1 pl-2 shadow-lg backdrop-blur-sm"
                style={{
                  left: courseDragSession.floatStyle.left,
                  top: courseDragSession.floatStyle.top,
                  width: courseDragSession.floatStyle.width,
                  height: courseDragSession.floatStyle.height,
                  borderLeftWidth: 4,
                  borderLeftColor: courseDragSession.block.color,
                }}
                aria-hidden
              >
                <span className="line-clamp-3 font-mono text-[10px] font-medium leading-tight text-foreground">
                  {courseDragSession.block.label}
                </span>
                {courseDragSession.block.sublabel.trim() ? (
                  <span className="line-clamp-2 font-mono text-[9px] text-muted-foreground">
                    {courseDragSession.block.sublabel}
                  </span>
                ) : null}
              </div>
            ) : null
          }
        />
      </div>

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
    </section>
  );
}
