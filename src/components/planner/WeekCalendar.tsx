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
import { filterFeasibleSwapGhosts } from "@/lib/planner/planner-swap-feasibility";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  Ban,
  Check,
  CircleHelp,
  Copy,
  Hand,
  Loader2,
  Minus,
  MousePointerClick,
  Pin,
  Plus,
  X,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlanner } from "./PlannerContext";

const HOUR_RANGE_HELP =
  "Zoom stops when 4 a.m. through 11 p.m. fill this view.";

const GESTURE_TIP_STORAGE_KEY = "uwyo.planner.weekCalTipDismissed";

const SCHEDULE_HELP: readonly {
  readonly Icon: typeof Hand;
  readonly label: string;
  readonly body: string;
}[] = [
  {
    Icon: Hand,
    label: "Pan the week",
    body: "On touch, use two fingers to pan: up, down, and side to side.",
  },
  {
    Icon: ZoomIn,
    label: "Zoom the day",
    body: `Pinch with two fingers, or use Ctrl+scroll, to show more or less of the day. ${HOUR_RANGE_HELP}`,
  },
  {
    Icon: MousePointerClick,
    label: "Open details",
    body: "Tap a block (without dragging) to read section details.",
  },
  {
    Icon: Pin,
    label: "Pin one slice",
    body: "When a course is on auto-pick, tap the pin on a lecture, lab, or discussion block to hold just that piece; other parts of the same course can still move. Tap again on the same block to unpin.",
  },
  {
    Icon: ArrowLeftRight,
    label: "Try another time",
    body: "Drag a section to preview other same-type meeting times that still fit your week, busy blocks, and filters; release on a highlighted slot to switch.",
  },
  {
    Icon: Ban,
    label: "Busy times",
    body: "Use “Mark busy time” and drag on a day column, or “Add busy…” for exact times. Busy blocks are respected while the planner finds a best-fit week. Two fingers still pan and zoom the week.",
  },
] as const;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const WEEKDAY_INDICES = [0, 1, 2, 3, 4] as const;
const FULL_WEEK_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

/** Sat=5, Sun=6 per `DAY_FIELDS` in derive.ts */
export function visibleDayIndicesForBlocks(
  blocks: readonly { dayIndex: number }[],
): readonly number[] {
  const hasSat = blocks.some((b) => b.dayIndex === 5);
  const hasSun = blocks.some((b) => b.dayIndex === 6);
  if (!hasSat && !hasSun) return WEEKDAY_INDICES;
  if (hasSat && hasSun) return FULL_WEEK_INDICES;
  if (hasSat) return [...WEEKDAY_INDICES, 5];
  return [...WEEKDAY_INDICES, 6];
}

/** Week columns when courses and/or busy blocks use weekend days. */
export function visibleDayIndicesMerged(
  blocks: readonly { dayIndex: number }[],
  blackouts: readonly { dayIndex: number }[],
): readonly number[] {
  const merged: { dayIndex: number }[] = [...blocks, ...blackouts];
  return visibleDayIndicesForBlocks(merged);
}

const MAX_HOUR_ROW_PX = 140;
const TWO_FINGER_PINCH_ZOOM_MIN_RATIO = 0.12;
const TWO_FINGER_PAN_STABLE_MAX_RATIO = 0.2;
const TWO_FINGER_PAN_CENTROID_MIN_PX = 5;
const PINCH_ZOOM_RESPONSE = 0.42;

type Props = {
  onBlockActivate: (block: CalendarBlock) => void;
};

function touchDistance(t: TouchList): number {
  const a = t[0];
  const b = t[1];
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function touchCentroidY(t: TouchList): number {
  return (t[0]!.clientY + t[1]!.clientY) / 2;
}

function touchCentroidX(t: TouchList): number {
  return (t[0]!.clientX + t[1]!.clientX) / 2;
}

function dampedPinchRowRatio(
  startRowPx: number,
  rawRatio: number,
  clamp: (n: number) => number,
): number {
  const t = 1 + (rawRatio - 1) * PINCH_ZOOM_RESPONSE;
  return clamp(startRowPx * t);
}

function formatQuarterHourLabel(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ap = h24 >= 12 ? "p.m." : "a.m.";
  const hr = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${hr}${mm} ${ap}`;
}

function clientYToMinutes(
  clientY: number,
  columnEl: HTMLElement,
  gridHeightPx: number,
  startMin: number,
  totalMin: number,
): number {
  const rect = columnEl.getBoundingClientRect();
  const y = clientY - rect.top;
  const frac = Math.max(0, Math.min(1, y / gridHeightPx));
  return startMin + frac * totalMin;
}

const DRAG_THRESHOLD_PX = 6;
const SNAP_MAX_DIST_PX = 72;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

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

function distPointToRect(
  px: number,
  py: number,
  r: { left: number; top: number; width: number; height: number },
): number {
  const cx = Math.max(r.left, Math.min(px, r.left + r.width));
  const cy = Math.max(r.top, Math.min(py, r.top + r.height));
  return Math.hypot(px - cx, py - cy);
}

function ghostViewportRect(
  g: SwapGhostMeeting,
  dayStrip: HTMLDivElement,
  gridHeightPx: number,
  startMin: number,
  totalMin: number,
  visibleDayIndices: readonly number[],
): { left: number; top: number; width: number; height: number } | null {
  const colOffset = visibleDayIndices.indexOf(g.dayIndex);
  if (colOffset < 0) return null;
  const col = dayStrip.children[colOffset] as HTMLElement | undefined;
  if (!col) return null;
  const cr = col.getBoundingClientRect();
  const topPx = ((g.startMinutes - startMin) / totalMin) * gridHeightPx;
  const rawH = ((g.endMinutes - g.startMinutes) / totalMin) * gridHeightPx;
  const heightPx = Math.max(8, rawH);
  return {
    left: cr.left + 2,
    top: cr.top + topPx,
    width: Math.max(0, cr.width - 4),
    height: heightPx,
  };
}

function buildFloatStyle(
  strip: HTMLDivElement | null,
  sess: {
    snapped: SwapGhostMeeting | null;
    ghosts: SwapGhostMeeting[];
    clientX: number;
    clientY: number;
    grabDx: number;
    grabDy: number;
  },
  gridHeightPx: number,
  startMin: number,
  totalMin: number,
  visibleDayIndices: readonly number[],
): { left: number; top: number; width: number; height: number } {
  if (strip && sess.snapped && sess.ghosts.length > 0) {
    const r = ghostViewportRect(
      sess.snapped,
      strip,
      gridHeightPx,
      startMin,
      totalMin,
      visibleDayIndices,
    );
    if (r && r.width > 0) return r;
  }
  return {
    left: sess.clientX - sess.grabDx,
    top: sess.clientY - sess.grabDy,
    width: 120,
    height: 48,
  };
}

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
    infeasibilityHints,
    mergedPackConstraintMaps,
    applyPlannerItemSelection,
    setSectionPinFromDrag,
    toggleSectionPin,
  } = usePlanner();
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
  const isWeekdaysOnlyView = visibleDayIndices.length === WEEKDAY_INDICES.length;
  const gridMinWidthRem =
    visibleDayIndices.length === FULL_WEEK_INDICES.length
      ? 40.5
      : 3.5 + visibleDayIndices.length * 4.5;

  const hScrollRef = useRef<HTMLDivElement | null>(null);
  const weekHeaderRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportH, setViewportH] = useState(0);
  const [hourRowPx, setHourRowPx] = useState<number | null>(null);

  const twoFingerRef = useRef<{
    startDist: number;
    startRowPx: number;
    startCentroidX: number;
    startCentroidY: number;
    startScrollTop: number;
    startScrollLeft: number;
    mode: "undecided" | "pinch" | "pan";
  } | null>(null);
  const hourRowPxRef = useRef(44);

  const startMin = CALENDAR_START_HOUR * 60;
  const totalMin = CALENDAR_HOUR_COUNT * 60;
  const hourCount = CALENDAR_HOUR_COUNT;

  const minRowPx = viewportH > 0 ? viewportH / hourCount : 1;

  const clampRowPx = useCallback(
    (v: number) => Math.min(MAX_HOUR_ROW_PX, Math.max(v, minRowPx)),
    [minRowPx],
  );

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
    (clientX: number, clientY: number, ghosts: SwapGhostMeeting[]) => {
      const strip = dayStripRef.current;
      if (!strip || ghosts.length === 0) return null;
      let best: SwapGhostMeeting | null = null;
      let bestD = SNAP_MAX_DIST_PX + 1;
      for (const g of ghosts) {
        const r = ghostViewportRect(
          g,
          strip,
          gridHeightPx,
          startMin,
          totalMin,
          visibleDayIndices,
        );
        if (!r || r.width <= 0) continue;
        const d = distPointToRect(clientX, clientY, r);
        if (d < bestD) {
          bestD = d;
          best = g;
        }
      }
      return bestD <= SNAP_MAX_DIST_PX ? best : null;
    },
    [gridHeightPx, startMin, totalMin, visibleDayIndices],
  );

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const measure = () => {
      const h = el.clientHeight;
      setViewportH(h);
      if (h <= 0) return;
      const floor = h / hourCount;
      setHourRowPx((prev) => {
        if (prev == null) return Math.max(44, floor);
        return Math.min(MAX_HOUR_ROW_PX, Math.max(prev, floor));
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hourCount]);

  useLayoutEffect(() => {
    hourRowPxRef.current = hourRowPx ?? Math.max(44, minRowPx);
  }, [hourRowPx, minRowPx]);

  useLayoutEffect(() => {
    const vEl = viewportRef.current;
    const headerEl = weekHeaderRef.current;
    if (!vEl) return;
    const getHScroll = () => hScrollRef.current;

    const beginTwoFinger = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const startDist = touchDistance(e.touches);
      if (startDist <= 0) {
        twoFingerRef.current = null;
        return;
      }
      const hS = getHScroll();
      twoFingerRef.current = {
        startDist,
        startRowPx: hourRowPxRef.current,
        startCentroidX: touchCentroidX(e.touches),
        startCentroidY: touchCentroidY(e.touches),
        startScrollTop: vEl.scrollTop,
        startScrollLeft: hS?.scrollLeft ?? 0,
        mode: "undecided",
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        const down = coursePointerDownRef.current;
        const cap = capturedCourseBlockElRef.current;
        if (cap && down) {
          try {
            cap.releasePointerCapture(down.pointerId);
          } catch {
            /* ignore */
          }
        }
        capturedCourseBlockElRef.current = null;
        if (down) endCourseDrag();
      }
      if (courseDragSessionRef.current) return;
      if (e.touches.length === 2) beginTwoFinger(e);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (courseDragSessionRef.current) return;
      if (e.touches.length !== 2) return;
      if (!twoFingerRef.current) beginTwoFinger(e);

      const sess = twoFingerRef.current;
      if (!sess) return;

      const d = touchDistance(e.touches);
      const cx = touchCentroidX(e.touches);
      const cy = touchCentroidY(e.touches);
      const d0 = sess.startDist;
      if (d0 <= 0) return;

      if (sess.mode === "undecided") {
        const relDist = Math.abs(d - d0) / d0;
        const dPos = Math.hypot(
          cx - sess.startCentroidX,
          cy - sess.startCentroidY,
        );
        const longSlide = dPos > 14 && relDist < 0.38;
        if (
          (dPos > TWO_FINGER_PAN_CENTROID_MIN_PX &&
            relDist < TWO_FINGER_PAN_STABLE_MAX_RATIO) ||
          longSlide
        ) {
          sess.mode = "pan";
        } else if (relDist > TWO_FINGER_PINCH_ZOOM_MIN_RATIO) {
          sess.mode = "pinch";
        } else {
          return;
        }
      }

      e.preventDefault();
      if (sess.mode === "pinch") {
        setHourRowPx(
          dampedPinchRowRatio(sess.startRowPx, d / d0, clampRowPx),
        );
      } else {
        const hS = getHScroll();
        vEl.scrollTop = sess.startScrollTop - (cy - sess.startCentroidY);
        if (hS) {
          hS.scrollLeft = sess.startScrollLeft - (cx - sess.startCentroidX);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) twoFingerRef.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setHourRowPx((prev) => {
        const base = prev ?? hourRowPxRef.current;
        const factor = e.deltaY > 0 ? 0.95 : 1.05;
        return clampRowPx(base * factor);
      });
    };

    const addTouch = (n: HTMLDivElement) => {
      n.addEventListener("touchstart", onTouchStart, { passive: true });
      n.addEventListener("touchmove", onTouchMove, { passive: false });
      n.addEventListener("touchend", onTouchEnd);
      n.addEventListener("touchcancel", onTouchEnd);
    };
    const removeTouch = (n: HTMLDivElement) => {
      n.removeEventListener("touchstart", onTouchStart);
      n.removeEventListener("touchmove", onTouchMove);
      n.removeEventListener("touchend", onTouchEnd);
      n.removeEventListener("touchcancel", onTouchEnd);
    };

    addTouch(vEl);
    if (headerEl) addTouch(headerEl);
    vEl.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      removeTouch(vEl);
      if (headerEl) removeTouch(headerEl);
      vEl.removeEventListener("wheel", onWheel);
    };
  }, [clampRowPx, endCourseDrag]);

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

  const openAddBusyDialog = useCallback(() => {
    setEditingBlackoutId(null);
    setFormDayIndex(0);
    setFormStartMin(9 * 60);
    setFormEndMin(10 * 60);
    setFormLabel("");
    setBusyDialogOpen(true);
  }, []);

  const openEditBlackout = useCallback((item: PlannerBlackoutItemV1) => {
    setEditingBlackoutId(item.id);
    setFormDayIndex(item.dayIndex);
    setFormStartMin(item.start);
    setFormEndMin(item.end);
    setFormLabel(item.label ?? "");
    setBusyDialogOpen(true);
  }, []);

  const commitBusyForm = useCallback(() => {
    const body = clampInterval({
      dayIndex: formDayIndex,
      start: formStartMin,
      end: formEndMin,
      label: formLabel.trim() || undefined,
    });
    if (body.end - body.start < 30) {
      setBusyDialogOpen(false);
      return;
    }
    const newId =
      globalThis.crypto?.randomUUID?.() ?? `b${Date.now().toString(36)}`;
    const next: PlannerBlackoutItemV1 = {
      id: editingBlackoutId ?? newId,
      dayIndex: body.dayIndex,
      start: body.start,
      end: body.end,
      label: body.label,
    };
    if (editingBlackoutId) {
      setBlackouts((prev) => ({
        v: 1,
        items: prev.items.map((i) => (i.id === editingBlackoutId ? next : i)),
      }));
    } else {
      setBlackouts((prev) => ({ v: 1, items: [...prev.items, next] }));
    }
    setBusyDialogOpen(false);
  }, [
    editingBlackoutId,
    formDayIndex,
    formEndMin,
    formLabel,
    formStartMin,
    setBlackouts,
  ]);

  const removeEditingBlackout = useCallback(() => {
    if (!editingBlackoutId) return;
    setBlackouts((prev) => ({
      v: 1,
      items: prev.items.filter((i) => i.id !== editingBlackoutId),
    }));
    setBusyDialogOpen(false);
  }, [editingBlackoutId, setBlackouts]);

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

  const hours: number[] = [];
  for (let h = CALENDAR_START_HOUR; h <= CALENDAR_END_HOUR; h++) hours.push(h);

  const zoomCalendarIn = useCallback(() => {
    setHourRowPx((prev) => clampRowPx((prev ?? minRowPx) * 1.08));
  }, [clampRowPx, minRowPx]);

  const zoomCalendarOut = useCallback(() => {
    setHourRowPx((prev) => clampRowPx((prev ?? minRowPx) / 1.08));
  }, [clampRowPx, minRowPx]);

  const displayWeekCrns = useMemo(
    () => collectDisplayCrnsForItems(effectivePlannerItems, catalog),
    [effectivePlannerItems, catalog],
  );

  const copyCrns = useCallback(async () => {
    if (displayWeekCrns.length === 0) return;
    try {
      await navigator.clipboard.writeText(displayWeekCrns.join("\n"));
      setCopyStatus("ok");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("err");
      window.setTimeout(() => setCopyStatus("idle"), 2500);
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

  const onCourseBlockPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, block: CalendarBlock) => {
      if (e.button !== 0) return;
      setSwapError(null);
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
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        return;
      }
      capturedCourseBlockElRef.current = el;
    },
    [],
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
        });
        const snapped = pickCourseSnap(
          lastCoursePointerRef.current.x,
          lastCoursePointerRef.current.y,
          ghosts,
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
        const snapped = pickCourseSnap(e.clientX, e.clientY, sess.ghosts);
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
          const baseItem = plannerItems.find(
            (r) => r.id === block.plannerItemId,
          );
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
      plannerItems,
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
        "scroll-mt-20 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
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
        {isRecalculatingSolutions ? (
          <p
            className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"
            aria-live="polite"
          >
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            Finding the best week…
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <h2
            id="planner-week-calendar-heading"
            className="font-heading min-w-0 text-lg font-medium text-foreground"
          >
            Weekly schedule
          </h2>
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-y-2 overflow-x-auto overflow-y-visible pb-1 [scrollbar-width:thin] sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
            <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:flex-wrap">
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
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
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
                  className="inline-flex items-center gap-1.5 text-xs text-destructive"
                  aria-live="polite"
                >
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                  Copy failed
                </span>
              ) : null}
            </div>
            <div
              className="flex h-9 min-w-0 max-w-full shrink-0 items-center justify-between gap-3 sm:ml-2 sm:max-w-full sm:border-l sm:border-border sm:pl-3"
            >
              <Label
                htmlFor="exclude-full-toggle"
                className="cursor-pointer text-sm leading-snug text-foreground"
              >
                Exclude full
              </Label>
              <Switch
                id="exclude-full-toggle"
                className="shrink-0"
                checked={requireOpenSections}
                onCheckedChange={(next) => {
                  setRequireOpenSections(next);
                  void recalculateSolutions(next);
                }}
              />
            </div>
            <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:ml-2 sm:flex-wrap sm:border-l sm:border-border sm:pl-3">
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
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-9 touch-manipulation"
                onClick={openAddBusyDialog}
              >
                <Plus className="mr-1.5 size-4 shrink-0" aria-hidden />
                Add busy…
              </Button>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:ml-2 sm:border-l sm:border-border sm:pl-3">
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="How to use the weekly schedule"
                  >
                    <CircleHelp className="size-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[min(32rem,85vh)] overflow-y-auto sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>How to use the weekly schedule</DialogTitle>
                    <DialogDescription>
                      Gestures for moving and zooming your week preview.
                    </DialogDescription>
                  </DialogHeader>
                  <ul className="list-none space-y-4">
                    {SCHEDULE_HELP.map((item) => {
                      const I = item.Icon;
                      return (
                        <li
                          key={item.label}
                          className="flex gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0"
                        >
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"
                            aria-hidden
                          >
                            <I className="size-4" strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {item.label}
                            </p>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                              {item.body}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </DialogContent>
              </Dialog>
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
              {infeasibilityHints.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : null}
          <p className="font-medium text-foreground">Nothing fits yet — try this</p>
          <p className="mt-1 text-sm text-muted-foreground">
            One or more of these usually unlocks a valid week:
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
                  — sometimes the opposite helps.
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
                  Add busy times
                </button>
                <span className="text-muted-foreground">
                  {" "}
                  only if something should stay free.
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
        <div
          className="flex flex-col"
          style={{ minWidth: `max(100%, ${gridMinWidthRem}rem)` }}
        >
          <div
            ref={weekHeaderRef}
            className="flex shrink-0 border-b border-border bg-muted/30"
          >
            <div className="w-14 shrink-0" aria-hidden />
            {visibleDayIndices.map((dayIndex) => (
              <div
                key={dayIndex}
                className="min-w-[4.5rem] flex-1 border-l border-border py-2 text-center font-mono text-xs font-medium text-muted-foreground"
              >
                {DAY_LABELS[dayIndex]}
              </div>
            ))}
          </div>

          <div
            ref={viewportRef}
            className="relative min-h-0 touch-none overflow-y-auto overscroll-y-contain"
            style={{ height: "min(72vh, 40rem)" }}
          >
            <div
              className="flex"
              style={{ minWidth: `max(100%, ${gridMinWidthRem}rem)` }}
            >
              <div className="flex w-14 shrink-0 flex-col border-r border-border bg-muted/20">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="flex items-start justify-end pr-1.5 font-mono text-[10px] leading-tight text-muted-foreground"
                    style={{ height: rowPx, minHeight: rowPx }}
                  >
                    {formatHour(h)}
                  </div>
                ))}
              </div>

              <div ref={dayStripRef} className="flex min-w-0 flex-1">
                {visibleDayIndices.map((dayIndex) => (
                  <div
                    key={dayIndex}
                    role="presentation"
                    className={cn(
                      "relative min-w-[4.5rem] flex-1 border-l border-border",
                      markBusyMode && "cursor-crosshair touch-manipulation",
                    )}
                    style={{ height: gridHeightPx, minHeight: gridHeightPx }}
                    onPointerDown={(e) => onDayColumnPointerDown(e, dayIndex)}
                    onPointerMove={onDayColumnPointerMove}
                    onPointerUp={onDayColumnPointerUp}
                    onPointerCancel={onDayColumnPointerCancel}
                  >
                    <div className="pointer-events-none absolute inset-0 flex flex-col">
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="border-b border-border/80"
                          style={{ height: rowPx, minHeight: rowPx }}
                        />
                      ))}
                    </div>
                    {blackouts.items
                      .filter((bo) => bo.dayIndex === dayIndex)
                      .map((bo) => {
                        const topPx =
                          ((bo.start - startMin) / totalMin) * gridHeightPx;
                        const rawH =
                          ((bo.end - bo.start) / totalMin) * gridHeightPx;
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
                      ? courseDragSession.ghosts
                          .filter((g) => g.dayIndex === dayIndex)
                          .map((g) => {
                            const topPx =
                              ((g.startMinutes - startMin) / totalMin) *
                              gridHeightPx;
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
                                  "pointer-events-none absolute left-0.5 right-0.5 z-[15] rounded-md border border-dashed border-muted-foreground/50 bg-muted/25",
                                  isSnap &&
                                    "border-primary/70 bg-primary/10 ring-1 ring-primary/40",
                                )}
                                style={{ top: topPx, height: heightPx }}
                                aria-hidden
                              />
                            );
                          })
                      : null}
                    {blocks
                      .filter((b) => b.dayIndex === dayIndex)
                      .map((b) => {
                        const topPx =
                          ((b.startMinutes - startMin) / totalMin) *
                          gridHeightPx;
                        const rawH =
                          ((b.endMinutes - b.startMinutes) / totalMin) *
                          gridHeightPx;
                        const heightPx = Math.max(8, rawH);
                        const pad = calendarBlockPaddingPx(heightPx);
                        const titlePx = calendarTitleFontPx(heightPx);
                        const secondaryPx = Math.max(7, titlePx - 1);
                        const tier = calendarSecondaryTier(heightPx);
                        const loc = b.sublabel.trim();
                        const inst = b.instructorSublabel?.trim() ?? "";
                        const titleAttr = [b.label, inst, loc]
                          .filter(Boolean)
                          .join(" · ");
                        let showInstructor = false;
                        let showLocation = false;
                        if (tier === "both") {
                          showInstructor = inst.length > 0;
                          showLocation = loc.length > 0;
                        } else if (tier === "one") {
                          if (inst.length > 0) showInstructor = true;
                          else if (loc.length > 0) showLocation = true;
                        }
                        const titleClampClass =
                          tier === "none"
                            ? "truncate"
                            : "line-clamp-2 min-h-0 break-words";
                        const rowItem = plannerItems.find(
                          (r) => r.id === b.plannerItemId,
                        );
                        const showPin = rowItem?.selectionKind === "unresolved";
                        const pinsDoc = rowItem
                          ? parseSectionPinsJson(rowItem.sectionPins)
                          : parseSectionPinsJson(null);
                        const isPinnedThisBlock =
                          pinsDoc.byType[b.sectionScheduleTypeKey] ===
                          b.sectionCrn;
                        const dimSource =
                          !!courseDragSession &&
                          courseDragSession.block.key === b.key &&
                          (courseDragSession.ghosts.length > 0 ||
                            courseDragSession.snapped != null);
                        return (
                          <div
                            key={b.key}
                            role="button"
                            tabIndex={0}
                            title={titleAttr}
                            aria-label={titleAttr}
                            className={cn(
                              "touch-none absolute left-0.5 right-0.5 z-[20] cursor-pointer overflow-hidden rounded-md border border-border bg-card text-left shadow-sm outline-none active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              "flex min-h-0 flex-col justify-start gap-0.5 border-l-[4px]",
                              dimSource && "opacity-35",
                            )}
                            style={{
                              top: topPx,
                              height: heightPx,
                              borderLeftColor: b.color,
                              paddingTop: pad,
                              paddingBottom: pad,
                              paddingLeft: Math.min(10, pad + 4),
                              paddingRight: Math.min(8, pad + 2),
                            }}
                            onPointerDown={(e) =>
                              onCourseBlockPointerDown(e, b)
                            }
                            onPointerMove={onCourseBlockPointerMove}
                            onPointerUp={onCourseBlockPointerUp}
                            onPointerCancel={onCourseBlockPointerCancel}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onBlockActivate(b);
                              }
                            }}
                          >
                            {showPin ? (
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
                                      isPinnedThisBlock &&
                                        "fill-primary text-primary",
                                    )}
                                    aria-hidden
                                  />
                                </Button>
                              </span>
                            ) : null}
                            <span
                              className={cn(
                                "min-w-0 font-mono font-medium leading-tight text-foreground",
                                titleClampClass,
                              )}
                              style={{ fontSize: titlePx }}
                            >
                              {b.label}
                            </span>
                            {showInstructor ? (
                              <span
                                className="line-clamp-1 min-w-0 font-mono leading-tight text-muted-foreground"
                                style={{ fontSize: secondaryPx }}
                              >
                                {inst}
                              </span>
                            ) : null}
                            {showLocation ? (
                              <span
                                className="line-clamp-1 min-w-0 font-mono leading-tight text-muted-foreground"
                                style={{ fontSize: secondaryPx }}
                              >
                                {loc}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
            {courseDragSession ? (
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
            ) : null}
          </div>
        </div>
      </div>

      <Dialog open={busyDialogOpen} onOpenChange={setBusyDialogOpen}>
        <DialogContent className="max-h-[min(32rem,90vh)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBlackoutId ? "Edit busy time" : "Add busy time"}
            </DialogTitle>
            <DialogDescription>
              Block times you are not available (work, commute, etc.). The
              planner avoids these intervals when building your week.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-2">
              <Label htmlFor="busy-day">Day</Label>
              <Select
                value={String(formDayIndex)}
                onValueChange={(v) => setFormDayIndex(Number(v))}
              >
                <SelectTrigger
                  id="busy-day"
                  className="min-h-11 w-full touch-manipulation"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_LABELS.map((label, di) => (
                    <SelectItem key={di} value={String(di)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="grid gap-2">
                <Label htmlFor="busy-start">Starts</Label>
                <Select
                  value={String(formStartMin)}
                  onValueChange={(v) => setFormStartMin(Number(v))}
                >
                  <SelectTrigger
                    id="busy-start"
                    className="min-h-11 w-full touch-manipulation"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timeQuarterOptions.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="busy-end">Ends</Label>
                <Select
                  value={String(formEndMin)}
                  onValueChange={(v) => setFormEndMin(Number(v))}
                >
                  <SelectTrigger
                    id="busy-end"
                    className="min-h-11 w-full touch-manipulation"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timeQuarterOptions.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="busy-label">Label (optional)</Label>
              <Input
                id="busy-label"
                className="min-h-11 touch-manipulation"
                maxLength={80}
                placeholder="e.g. Work"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {editingBlackoutId ? (
              <Button
                type="button"
                variant="destructive"
                className="min-h-11 w-full touch-manipulation sm:w-auto"
                onClick={removeEditingBlackout}
              >
                Remove
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 touch-manipulation"
                onClick={() => setBusyDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="min-h-11 touch-manipulation"
                onClick={commitBusyForm}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function formatHour(h: number): string {
  const ap = h >= 12 ? "p.m." : "a.m.";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ap}`;
}

function calendarBlockPaddingPx(heightPx: number): number {
  return Math.min(6, Math.max(1, Math.round(heightPx * 0.06)));
}

function calendarTitleFontPx(heightPx: number): number {
  return Math.min(11, Math.max(8, Math.round(heightPx * 0.2)));
}

/** How many secondary lines (instructor / location) fit at this zoom level. */
function calendarSecondaryTier(
  heightPx: number,
): "none" | "one" | "both" {
  if (heightPx < 28) return "none";
  if (heightPx < 44) return "one";
  return "both";
}
