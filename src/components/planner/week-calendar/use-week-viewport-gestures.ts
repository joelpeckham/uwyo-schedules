"use client";

import {
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
  useLayoutEffect,
} from "react";
import {
  dampedPinchRowRatio,
  touchCentroidX,
  touchCentroidY,
  touchDistance,
} from "./interaction";
import {
  TWO_FINGER_PAN_CENTROID_MIN_PX,
  TWO_FINGER_PAN_STABLE_MAX_RATIO,
  TWO_FINGER_PINCH_ZOOM_MIN_RATIO,
} from "./constants";

type TwoFingerSession = {
  startDist: number;
  startRowPx: number;
  startCentroidX: number;
  startCentroidY: number;
  startScrollTop: number;
  startScrollLeft: number;
  mode: "undecided" | "pinch" | "pan";
};

type Params = {
  viewportRef: RefObject<HTMLDivElement | null>;
  weekHeaderRef: RefObject<HTMLDivElement | null>;
  hScrollRef: RefObject<HTMLDivElement | null>;
  hourRowPxRef: MutableRefObject<number>;
  clampRowPx: (v: number) => number;
  setHourRowPx: Dispatch<SetStateAction<number | null>>;
  endCourseDrag: () => void;
  courseDragSessionRef: MutableRefObject<unknown>;
  coursePointerDownRef: MutableRefObject<{ pointerId: number } | null>;
  capturedCourseBlockElRef: MutableRefObject<HTMLElement | null>;
};

/**
 * Two-finger pan/pinch on the week header + viewport, and Ctrl+wheel zoom.
 * Releases course pointer capture when a second finger lands so two-finger
 * navigation still works mid-drag teardown.
 */
export function useWeekViewportGestures({
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
}: Params): void {
  useLayoutEffect(() => {
    const vEl = viewportRef.current;
    const headerEl = weekHeaderRef.current;
    if (!vEl) return;
    const getHScroll = () => hScrollRef.current;

    const twoFingerRef: { current: TwoFingerSession | null } = { current: null };

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
        const dPos = Math.hypot(cx - sess.startCentroidX, cy - sess.startCentroidY);
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
        setHourRowPx(dampedPinchRowRatio(sess.startRowPx, d / d0, clampRowPx));
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
  }, [
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
  ]);
}
