"use client";

import {
  commitPlannerSwapFromCalendarAction,
  getSameTypeSectionMeetingsForSwapAction,
} from "@/app/planner/actions";
import {
  swapPrefetchKey,
  type CalendarBlock,
  type SwapGhostMeeting,
} from "@/lib/planner/data";
import {
  CALENDAR_END_HOUR,
  CALENDAR_HOUR_COUNT,
  CALENDAR_START_HOUR,
} from "@/lib/planner/constants";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Maximum row height when zoomed in (px). */
const MAX_HOUR_ROW_PX = 140;

const DRAG_THRESHOLD_PX = 6;
const SNAP_MAX_DIST_PX = 72;
/** If inter-finger distance *ratio* is above this, treat as pinch (not two-finger pan). */
const TWO_FINGER_PINCH_ZOOM_MIN_RATIO = 0.12;
/**
 * Two-finger *pan* needs finger spread to stay under this ratio; a vertical slide
 * often wiggles spread by 5–15% while pinch-zoom crosses this quickly.
 */
const TWO_FINGER_PAN_STABLE_MAX_RATIO = 0.2;
/** Centroid must move this far (px) before two-finger pan (scroll) is chosen. */
const TWO_FINGER_PAN_CENTROID_MIN_PX = 5;
/**
 * Dampen pinch: raw inter-finger ratio r → 1 + (r - 1) * PINCH_ZOOM_RESPONSE
 * (small pinches change row height more gently than 1:1 with finger spread).
 */
const PINCH_ZOOM_RESPONSE = 0.42;

type Props = {
  termCode: string;
  blocks: CalendarBlock[];
  /** Server-prefetched ghosts so drag starts without a server round trip. */
  swapGhostsPrefetch?: Record<string, SwapGhostMeeting[]>;
  /** After a successful swap, reload planner UI without a full RSC refresh. */
  onPlannerCalendarUpdated: () => Promise<boolean>;
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
  swapError: string | null;
  floatStyle: { left: number; top: number; width: number; height: number };
};

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
): { left: number; top: number; width: number; height: number } {
  if (strip && sess.snapped && sess.ghosts.length > 0) {
    const r = ghostViewportRect(
      sess.snapped,
      strip,
      gridHeightPx,
      startMin,
      totalMin,
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
): { left: number; top: number; width: number; height: number } | null {
  const col = dayStrip.children[g.dayIndex] as HTMLElement | undefined;
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

/** Map inter-finger distance ratio to a gentler zoom (see PINCH_ZOOM_RESPONSE). */
function dampedPinchRowRatio(
  startRowPx: number,
  rawRatio: number,
  clamp: (n: number) => number,
): number {
  const t = 1 + (rawRatio - 1) * PINCH_ZOOM_RESPONSE;
  return clamp(startRowPx * t);
}

export function WeekCalendar({
  termCode,
  blocks,
  swapGhostsPrefetch = {},
  onPlannerCalendarUpdated,
  onBlockActivate,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hScrollRef = useRef<HTMLDivElement | null>(null);
  /** Day labels row: same two-finger handlers as the viewport (not the overflow-x scroller: non-passive touch on that ancestor breaks iOS). */
  const weekHeaderRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dayStripRef = useRef<HTMLDivElement | null>(null);
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

  const dragGenRef = useRef(0);
  const dragActiveRef = useRef(false);
  const dragSessionRef = useRef<DragSessionState | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const pointerDownRef = useRef<{
    block: CalendarBlock;
    clientX: number;
    clientY: number;
    pointerId: number;
  } | null>(null);
  const grabOffsetRef = useRef({ dx: 0, dy: 0 });
  /** `setPointerCapture` target for block; cleared on pointer up / cancellation / 2+ touches. */
  const capturedBlockElRef = useRef<HTMLElement | null>(null);
  const warmCacheRef = useRef(new Map<string, SwapGhostMeeting[]>());
  const warmInflightRef = useRef(new Set<string>());

  const [dragSession, setDragSession] = useState<DragSessionState | null>(
    null,
  );
  const [postSwapError, setPostSwapError] = useState<string | null>(null);

  useEffect(() => {
    dragSessionRef.current = dragSession;
  }, [dragSession]);

  useLayoutEffect(() => {
    for (const [k, v] of Object.entries(swapGhostsPrefetch)) {
      warmCacheRef.current.set(k, v);
    }
  }, [swapGhostsPrefetch]);

  const peekGhostCache = useCallback((block: CalendarBlock) => {
    const k = swapPrefetchKey(
      block.plannerItemId,
      block.sectionCrn,
      block.meetingId,
    );
    if (warmCacheRef.current.has(k)) {
      return warmCacheRef.current.get(k)!;
    }
    return undefined;
  }, []);

  const scheduleGhostWarm = useCallback(
    (block: CalendarBlock) => {
      const k = swapPrefetchKey(
        block.plannerItemId,
        block.sectionCrn,
        block.meetingId,
      );
      if (warmInflightRef.current.has(k)) return;
      if (warmCacheRef.current.has(k)) return;
      warmInflightRef.current.add(k);
      void getSameTypeSectionMeetingsForSwapAction({
        termCode,
        plannerItemId: block.plannerItemId,
        sourceSectionCrn: block.sectionCrn,
        sourceMeetingId: block.meetingId,
      }).then((res) => {
        warmInflightRef.current.delete(k);
        if (res.ok) warmCacheRef.current.set(k, res.ghosts);
      });
    },
    [termCode],
  );

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

  const endDrag = useCallback(() => {
    dragGenRef.current += 1;
    dragActiveRef.current = false;
    dragSessionRef.current = null;
    pointerDownRef.current = null;
    capturedBlockElRef.current = null;
    setDragSession(null);
  }, []);

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
        const down = pointerDownRef.current;
        const cap = capturedBlockElRef.current;
        if (cap && down) {
          try {
            cap.releasePointerCapture(down.pointerId);
          } catch {
            /* ignore */
          }
        }
        capturedBlockElRef.current = null;
        if (down) endDrag();
      }
      if (dragSessionRef.current) return;
      if (e.touches.length === 2) beginTwoFinger(e);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (dragSessionRef.current) return;
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
        // Use 2D centroid travel so pure horizontal (week strip) and vertical
        // (time grid) two-finger pan both commit to *pan* instead of pinch.
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
      if (dragSessionRef.current) return;
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
  }, [clampRowPx, endDrag]);

  const rowPx = hourRowPx ?? Math.max(44, minRowPx);
  const gridHeightPx = hourCount * rowPx;

  const finalizeDragSession = useCallback(
    (
      s: Omit<DragSessionState, "floatStyle">,
    ): DragSessionState => ({
      ...s,
      floatStyle: buildFloatStyle(
        dayStripRef.current,
        s,
        gridHeightPx,
        startMin,
        totalMin,
      ),
    }),
    [gridHeightPx, startMin, totalMin],
  );

  const pickSnap = useCallback(
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
    [gridHeightPx, startMin, totalMin],
  );

  useEffect(() => {
    if (!dragSession) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") endDrag();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dragSession, endDrag]);

  const onBlockPointerDown = useCallback(
    (e: React.PointerEvent, block: CalendarBlock) => {
      if (e.button !== 0) return;
      setPostSwapError(null);
      scheduleGhostWarm(block);
      const el = e.currentTarget as HTMLElement;
      const br = el.getBoundingClientRect();
      grabOffsetRef.current = {
        dx: e.clientX - br.left,
        dy: e.clientY - br.top,
      };
      pointerDownRef.current = {
        block,
        clientX: e.clientX,
        clientY: e.clientY,
        pointerId: e.pointerId,
      };
      el.setPointerCapture(e.pointerId);
      capturedBlockElRef.current = el;
    },
    [scheduleGhostWarm],
  );

  const onBlockPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const down = pointerDownRef.current;
      if (!down || e.pointerId !== down.pointerId) return;

      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      const dx = e.clientX - down.clientX;
      const dy = e.clientY - down.clientY;
      const dist = Math.hypot(dx, dy);

      if (!dragActiveRef.current && dist >= DRAG_THRESHOLD_PX) {
        e.preventDefault();
        dragActiveRef.current = true;
        const gen = ++dragGenRef.current;
        const b = down.block;
        const cached = peekGhostCache(b);
        if (cached !== undefined) {
          const snapped = pickSnap(
            lastPointerRef.current.x,
            lastPointerRef.current.y,
            cached,
          );
          const next = finalizeDragSession({
            block: b,
            pointerId: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY,
            grabDx: grabOffsetRef.current.dx,
            grabDy: grabOffsetRef.current.dy,
            ghosts: cached,
            snapped,
            swapError: null,
          });
          dragSessionRef.current = next;
          setDragSession(next);
          return;
        }
        const initial = finalizeDragSession({
          block: b,
          pointerId: e.pointerId,
          clientX: e.clientX,
          clientY: e.clientY,
          grabDx: grabOffsetRef.current.dx,
          grabDy: grabOffsetRef.current.dy,
          ghosts: [],
          snapped: null,
          swapError: null,
        });
        dragSessionRef.current = initial;
        setDragSession(initial);
        startTransition(async () => {
          const res = await getSameTypeSectionMeetingsForSwapAction({
            termCode,
            plannerItemId: b.plannerItemId,
            sourceSectionCrn: b.sectionCrn,
            sourceMeetingId: b.meetingId,
          });
          if (dragGenRef.current !== gen) return;
          if (!res.ok) {
            const errSess = finalizeDragSession({
              block: b,
              pointerId: down.pointerId,
              clientX: lastPointerRef.current.x,
              clientY: lastPointerRef.current.y,
              grabDx: grabOffsetRef.current.dx,
              grabDy: grabOffsetRef.current.dy,
              ghosts: [],
              snapped: null,
              swapError: res.error,
            });
            dragSessionRef.current = errSess;
            setDragSession(errSess);
            return;
          }
          const k = swapPrefetchKey(
            b.plannerItemId,
            b.sectionCrn,
            b.meetingId,
          );
          warmCacheRef.current.set(k, res.ghosts);
          const snapped = pickSnap(
            lastPointerRef.current.x,
            lastPointerRef.current.y,
            res.ghosts,
          );
          const next = finalizeDragSession({
            block: b,
            pointerId: down.pointerId,
            clientX: lastPointerRef.current.x,
            clientY: lastPointerRef.current.y,
            grabDx: grabOffsetRef.current.dx,
            grabDy: grabOffsetRef.current.dy,
            ghosts: res.ghosts,
            snapped,
            swapError: null,
          });
          dragSessionRef.current = next;
          setDragSession(next);
        });
        return;
      }

      if (dragActiveRef.current && e.pointerId === down.pointerId) {
        e.preventDefault();
        const sess = dragSessionRef.current;
        if (!sess) return;
        const snapped = pickSnap(e.clientX, e.clientY, sess.ghosts);
        const next = finalizeDragSession({
          block: sess.block,
          pointerId: sess.pointerId,
          clientX: e.clientX,
          clientY: e.clientY,
          grabDx: sess.grabDx,
          grabDy: sess.grabDy,
          ghosts: sess.ghosts,
          snapped,
          swapError: sess.swapError,
        });
        dragSessionRef.current = next;
        setDragSession(next);
      }
    },
    [finalizeDragSession, peekGhostCache, pickSnap, startTransition, termCode],
  );

  const onBlockPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const down = pointerDownRef.current;
      if (!down || e.pointerId !== down.pointerId) return;

      const dx = e.clientX - down.clientX;
      const dy = e.clientY - down.clientY;
      const dist = Math.hypot(dx, dy);

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const session = dragSessionRef.current;
      const wasDrag = dragActiveRef.current;

      pointerDownRef.current = null;
      capturedBlockElRef.current = null;

      if (wasDrag && session && e.pointerId === session.pointerId) {
        const { snapped, block } = session;
        if (snapped && snapped.crn !== block.sectionCrn) {
          endDrag();
          startTransition(async () => {
            const res = await commitPlannerSwapFromCalendarAction({
              termCode,
              plannerItemId: block.plannerItemId,
              targetCrn: snapped.crn,
              sourceSectionCrn: block.sectionCrn,
              sourceMeetingId: block.meetingId,
            });
            if (!res.ok) {
              setPostSwapError(res.error);
              return;
            }
            const refreshed = await onPlannerCalendarUpdated();
            if (!refreshed) router.refresh();
          });
          return;
        }
        endDrag();
        return;
      }

      if (dist < DRAG_THRESHOLD_PX) {
        onBlockActivate(down.block);
      }
    },
    [
      endDrag,
      onBlockActivate,
      onPlannerCalendarUpdated,
      router,
      startTransition,
      termCode,
    ],
  );

  const onBlockPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (pointerDownRef.current?.pointerId !== e.pointerId) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      pointerDownRef.current = null;
      endDrag();
    },
    [endDrag],
  );

  const hours: number[] = [];
  for (let h = CALENDAR_START_HOUR; h <= CALENDAR_END_HOUR; h++) hours.push(h);

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        dragSession && "select-none",
      )}
      aria-labelledby="planner-week-calendar-heading"
    >
      <div className="border-b border-border p-3 sm:p-4">
        <h2
          id="planner-week-calendar-heading"
          className="font-heading text-lg font-medium text-foreground"
        >
          Weekly schedule
        </h2>
        <p className="mt-1 max-w-prose text-pretty text-xs text-muted-foreground sm:text-sm">
          On touch, use two fingers to pan the week (up, down, and side to side).
          Pinch with two fingers or use Ctrl-scroll to show more or less of the
          day. Zoom stops when 4 a.m. through 11 p.m. fill this view.
        </p>
        <p className="mt-2 max-w-prose text-pretty text-xs text-muted-foreground sm:text-sm">
          Drag a section with one finger to preview other same-type meeting
          times; release on a highlighted slot to switch sections. Tap without
          dragging for details.
        </p>
        {dragSession?.swapError ? (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {dragSession.swapError}
          </p>
        ) : null}
        {postSwapError ? (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {postSwapError}
          </p>
        ) : null}
      </div>

      <div
        ref={hScrollRef}
        className="overflow-x-auto"
      >
        <div className="flex min-w-[40rem] flex-col">
          <div
            ref={weekHeaderRef}
            className="flex shrink-0 border-b border-border bg-muted/30"
          >
            <div className="w-12 shrink-0" aria-hidden />
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                className="min-w-[4.5rem] flex-1 border-l border-border py-2 text-center font-mono text-xs font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          <div
            ref={viewportRef}
            className="relative min-h-0 touch-none overflow-y-auto overscroll-y-contain"
            style={{ height: "min(70vh, 32rem)" }}
          >
            <div className="flex min-w-[40rem]">
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

              <div className="flex min-w-0 flex-1" ref={dayStripRef}>
                {DAY_LABELS.map((label, dayIndex) => (
                  <div
                    key={label}
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
                    {dragSession
                      ? dragSession.ghosts
                          .filter((g) => g.dayIndex === dayIndex)
                          .map((g) => {
                            const topPx =
                              ((g.startMinutes - startMin) / totalMin) *
                              gridHeightPx;
                            const rawH =
                              ((g.endMinutes - g.startMinutes) / totalMin) *
                              gridHeightPx;
                            const heightPx = Math.max(8, rawH);
                            const sn = dragSession.snapped;
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
                                  "pointer-events-none absolute left-0.5 right-0.5 rounded-md border border-dashed border-muted-foreground/50 bg-muted/25",
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
                        const dimSource =
                          !!dragSession &&
                          dragSession.block.key === b.key &&
                          (dragSession.ghosts.length > 0 ||
                            !!dragSession.swapError);
                        return (
                          <button
                            key={b.key}
                            type="button"
                            className={cn(
                              "touch-none absolute left-0.5 right-0.5 overflow-hidden rounded-md border border-border bg-card py-1.5 pr-1 pl-2 text-left shadow-sm active:scale-[0.99]",
                              "flex flex-col gap-0.5 border-l-[4px]",
                              dimSource && "opacity-35",
                            )}
                            style={{
                              top: topPx,
                              height: heightPx,
                              borderLeftColor: b.color,
                            }}
                            onPointerDown={(e) => onBlockPointerDown(e, b)}
                            onPointerMove={onBlockPointerMove}
                            onPointerUp={onBlockPointerUp}
                            onPointerCancel={onBlockPointerCancel}
                          >
                            <span className="line-clamp-3 font-mono text-[10px] font-medium leading-tight text-foreground">
                              {b.label}
                            </span>
                            {b.sublabel ? (
                              <span className="line-clamp-2 font-mono text-[9px] text-muted-foreground">
                                {b.sublabel}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>

            {dragSession ? (
              <div
                className="pointer-events-none fixed z-60 overflow-hidden rounded-md border border-border bg-card/95 py-1.5 pr-1 pl-2 shadow-lg backdrop-blur-sm"
                style={{
                  left: dragSession.floatStyle.left,
                  top: dragSession.floatStyle.top,
                  width: dragSession.floatStyle.width,
                  height: dragSession.floatStyle.height,
                  borderLeftWidth: 4,
                  borderLeftColor: dragSession.block.color,
                }}
                aria-hidden
              >
                <span className="line-clamp-3 font-mono text-[10px] font-medium leading-tight text-foreground">
                  {dragSession.block.label}
                </span>
                {dragSession.block.sublabel ? (
                  <span className="line-clamp-2 font-mono text-[9px] text-muted-foreground">
                    {dragSession.block.sublabel}
                  </span>
                ) : null}
              </div>
            ) : null}
            {pending && dragSession ? (
              <div
                className="pointer-events-none absolute right-2 bottom-2 rounded-md bg-muted/90 px-2 py-1 font-mono text-[10px] text-muted-foreground"
                aria-live="polite"
              >
                Loading alternatives…
              </div>
            ) : null}
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
