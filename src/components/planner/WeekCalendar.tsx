"use client";

import type { CalendarBlock } from "@/lib/planner/data";
import {
  clampInterval,
  snapIntervalEndpoints,
  type PlannerBlackoutItemV1,
} from "@/lib/planner/blackouts";
import {
  CALENDAR_END_HOUR,
  CALENDAR_HOUR_COUNT,
  CALENDAR_START_HOUR,
} from "@/lib/planner/constants";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Ban,
  CircleHelp,
  Minus,
  Move,
  MousePointerClick,
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
  readonly Icon: typeof Move;
  readonly label: string;
  readonly body: string;
}[] = [
  {
    Icon: Move,
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
    body: "Tap a block to read section details.",
  },
  {
    Icon: Ban,
    label: "Busy times",
    body: "Use “Mark busy time” and drag on a day column, or “Add busy…” for exact times. Busy blocks are avoided when paging schedules. Two fingers still pan and zoom the week.",
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

export function WeekCalendar({ onBlockActivate }: Props) {
  const { calendarBlocks: blocks, blackouts, setBlackouts } = usePlanner();
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
        setShowGestureTip(true);
      }
    } catch {
      /* private mode or blocked */
    }
  }, []);
  const dragSessionRef = useRef<{
    dayIndex: number;
    columnEl: HTMLElement;
    pointerId: number;
    startClientY: number;
    anchorMinutes: number;
  } | null>(null);

  const visibleDayIndices = useMemo(
    () => visibleDayIndicesMerged(blocks, blackouts.items),
    [blocks, blackouts.items],
  );
  const isWeekdaysOnlyView = visibleDayIndices.length === WEEKDAY_INDICES.length;
  const gridMinWidthRem =
    visibleDayIndices.length === FULL_WEEK_INDICES.length
      ? 40
      : 3 + visibleDayIndices.length * 4.5;

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
      if (e.touches.length === 2) beginTwoFinger(e);
    };

    const onTouchMove = (e: TouchEvent) => {
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
  }, [clampRowPx]);

  const rowPx = hourRowPx ?? Math.max(44, minRowPx);
  const gridHeightPx = hourCount * rowPx;

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
      const sess = dragSessionRef.current;
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
      dragSessionRef.current = null;
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
      dragSessionRef.current = {
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
      const sess = dragSessionRef.current;
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
      const sess = dragSessionRef.current;
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
      const sess = dragSessionRef.current;
      if (!sess || e.pointerId !== sess.pointerId) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragSessionRef.current = null;
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

  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
          <h2
            id="planner-week-calendar-heading"
            className="font-heading min-w-0 text-lg font-medium text-foreground"
          >
            Weekly schedule
          </h2>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant={markBusyMode ? "default" : "outline"}
              size="default"
              className="min-h-11 touch-manipulation"
              aria-pressed={markBusyMode}
              onClick={() => {
                setMarkBusyMode((v) => !v);
                dragSessionRef.current = null;
                setDragPreview(null);
              }}
            >
              Mark busy time
            </Button>
            <Button
              type="button"
              variant="outline"
              size="default"
              className="min-h-11 touch-manipulation"
              onClick={openAddBusyDialog}
            >
              <Plus className="mr-1.5 size-4 shrink-0" aria-hidden />
              Add busy…
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="touch-manipulation"
              aria-label="Zoom week view out"
              onClick={zoomCalendarOut}
            >
              <Minus className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
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
                size="icon"
                className="text-muted-foreground hover:text-foreground -mt-0.5 shrink-0"
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

      <div ref={hScrollRef} className="overflow-x-auto">
        <div
          className="flex flex-col"
          style={{ minWidth: `max(100%, ${gridMinWidthRem}rem)` }}
        >
          <div
            ref={weekHeaderRef}
            className="flex shrink-0 border-b border-border bg-muted/30"
          >
            <div className="w-12 shrink-0" aria-hidden />
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
            style={{ height: "min(70vh, 32rem)" }}
          >
            <div
              className="flex"
              style={{ minWidth: `max(100%, ${gridMinWidthRem}rem)` }}
            >
              <div className="flex w-12 shrink-0 flex-col border-r border-border bg-muted/20">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="flex items-start justify-end pr-1 font-mono text-[10px] leading-tight text-muted-foreground"
                    style={{ height: rowPx, minHeight: rowPx }}
                  >
                    {formatHour(h)}
                  </div>
                ))}
              </div>

              <div className="flex min-w-0 flex-1">
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
                        return (
                          <button
                            key={b.key}
                            type="button"
                            title={titleAttr}
                            className={cn(
                              "touch-none absolute left-0.5 right-0.5 z-[20] overflow-hidden rounded-md border border-border bg-card text-left shadow-sm active:scale-[0.99]",
                              "flex min-h-0 flex-col justify-start gap-0.5 border-l-[4px]",
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
                            onClick={() => onBlockActivate(b)}
                          >
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
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
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
              Block times you are not available (work, commute, etc.). Valid
              schedules skip these intervals.
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
