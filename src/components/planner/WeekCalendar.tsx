"use client";

import type { CalendarBlock } from "@/lib/planner/data";
import {
  CALENDAR_END_HOUR,
  CALENDAR_HOUR_COUNT,
  CALENDAR_START_HOUR,
} from "@/lib/planner/constants";
import { cn } from "@/lib/utils";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Move, MousePointerClick, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePlanner } from "./PlannerContext";

const HOUR_RANGE_HELP =
  "Zoom stops when 4 a.m. through 11 p.m. fill this view.";

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
    body: "Tap a block to read section details from Banner.",
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

export function WeekCalendar({ onBlockActivate }: Props) {
  const { calendarBlocks: blocks } = usePlanner();
  const visibleDayIndices = useMemo(
    () => visibleDayIndicesForBlocks(blocks),
    [blocks],
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

  const hours: number[] = [];
  for (let h = CALENDAR_START_HOUR; h <= CALENDAR_END_HOUR; h++) hours.push(h);

  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
      aria-labelledby="planner-week-calendar-heading"
    >
      {isWeekdaysOnlyView ? (
        <p className="sr-only">
          Showing Monday through Friday. Saturday or Sunday columns appear when
          a selected course meets on that day.
        </p>
      ) : null}
      <div className="border-b border-border p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <h2
            id="planner-week-calendar-heading"
            className="font-heading min-w-0 text-lg font-medium text-foreground"
          >
            Weekly schedule
          </h2>
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
                    className="relative min-w-[4.5rem] flex-1 border-l border-border"
                    style={{ height: gridHeightPx, minHeight: gridHeightPx }}
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
                              "touch-none absolute left-0.5 right-0.5 overflow-hidden rounded-md border border-border bg-card text-left shadow-sm active:scale-[0.99]",
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
