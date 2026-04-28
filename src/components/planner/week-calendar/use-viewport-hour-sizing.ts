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
import { MAX_HOUR_ROW_PX } from "./interaction";

/**
 * Measures the scroll viewport height and derives an hour-row pixel size with
 * pinch/zoom clamps. Keeps `hourRowPxRef` in sync for non-React listeners.
 */
export function useViewportHourSizing(hourCount: number): {
  viewportRef: RefObject<HTMLDivElement | null>;
  viewportH: number;
  hourRowPx: number | null;
  setHourRowPx: Dispatch<SetStateAction<number | null>>;
  hourRowPxRef: MutableRefObject<number>;
  clampRowPx: (v: number) => number;
  minRowPx: number;
} {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportH, setViewportH] = useState(0);
  const [hourRowPx, setHourRowPx] = useState<number | null>(null);
  const hourRowPxRef = useRef(44);

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

  return {
    viewportRef,
    viewportH,
    hourRowPx,
    setHourRowPx,
    hourRowPxRef,
    clampRowPx,
    minRowPx,
  };
}
