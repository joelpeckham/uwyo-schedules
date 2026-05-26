"use client";

import {
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  initialPlannerHourRowPx,
  MAX_HOUR_ROW_PX,
  MIN_HOUR_ROW_PX,
} from "./constants";

/**
 * Measures the scroll viewport height and derives an hour-row pixel size with
 * pinch/zoom clamps. Keeps `hourRowPxRef` in sync for non-React listeners.
 *
 * `hourRowPx` is initialized from the same CSS viewport expression as the grid
 * (`min(72vh, 40rem) / hourCount`) so the first paint does not jump when
 * ResizeObserver runs.
 */
export function useViewportHourSizing(hourCount: number): {
  viewportRef: RefObject<HTMLDivElement | null>;
  hourRowPx: number;
  setHourRowPx: Dispatch<SetStateAction<number>>;
  hourRowPxRef: MutableRefObject<number>;
  clampRowPx: (v: number) => number;
  minRowPx: number;
} {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportH, setViewportH] = useState(0);
  const [hourRowPx, setHourRowPx] = useState(() =>
    initialPlannerHourRowPx(hourCount),
  );
  const hourRowPxRef = useRef(hourRowPx);

  const minRowPx =
    viewportH > 0 ? viewportH / hourCount : initialPlannerHourRowPx(hourCount);

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
      setHourRowPx((prev) =>
        Math.min(MAX_HOUR_ROW_PX, Math.max(prev, floor, MIN_HOUR_ROW_PX)),
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hourCount]);

  useLayoutEffect(() => {
    hourRowPxRef.current = hourRowPx;
  }, [hourRowPx]);

  return {
    viewportRef,
    hourRowPx,
    setHourRowPx,
    hourRowPxRef,
    clampRowPx,
    minRowPx,
  };
}
