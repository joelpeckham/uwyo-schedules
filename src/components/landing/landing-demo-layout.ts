"use client";

import { type RefObject, useLayoutEffect, useState } from "react";

import {
  MAX_HOUR_ROW_PX,
  MIN_HOUR_ROW_PX,
} from "@/components/planner/week-calendar/constants";

/** Scroll viewport height while the mobile sticky animation is active. */
export const LANDING_DEMO_VIEWPORT_HEIGHT =
  "min(52dvh, 30rem, calc(100dvh - 14rem))";

/** Matches the `30rem` cap at a 16px root. */
const LANDING_DEMO_VIEWPORT_MAX_PX = 480;

/** SSR-safe hour-row height; matches first paint before ResizeObserver sync. */
function initialLandingDemoHourRowPx(hourCount: number): number {
  const floor = LANDING_DEMO_VIEWPORT_MAX_PX / hourCount;
  return Math.min(MAX_HOUR_ROW_PX, Math.max(MIN_HOUR_ROW_PX, floor));
}

/** Sync hour-row height to the rendered viewport after hydration. */
export function useLandingDemoRowPx(
  viewportRef: RefObject<HTMLDivElement | null>,
  hourCount: number,
): number {
  const estimate = initialLandingDemoHourRowPx(hourCount);
  const [measuredRowPx, setMeasuredRowPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const sync = () => {
      const heightPx = node.clientHeight;
      if (heightPx <= 0) return;
      const floor = heightPx / hourCount;
      setMeasuredRowPx(
        Math.min(MAX_HOUR_ROW_PX, Math.max(MIN_HOUR_ROW_PX, floor)),
      );
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(node);
    return () => ro.disconnect();
  }, [hourCount, viewportRef]);

  return measuredRowPx ?? estimate;
}

/** Sticky / fallback shell for narrow viewports. */
export const LANDING_DEMO_MOBILE_STICKY_SHELL_CLASS =
  "max-lg:h-[100dvh] max-lg:overflow-hidden";
