"use client";

import {
  type CSSProperties,
  type RefObject,
  useLayoutEffect,
  useState,
} from "react";

import {
  MAX_HOUR_ROW_PX,
  MIN_HOUR_ROW_PX,
} from "@/components/planner/week-calendar/constants";

/** Scroll viewport height while the mobile sticky animation is active. */
export const LANDING_DEMO_VIEWPORT_HEIGHT =
  "min(52dvh, 30rem, calc(100dvh - 14rem))";

/** Taller grid before the sticky animation engages. */
export const LANDING_DEMO_VIEWPORT_HEIGHT_INTRO = "min(60vh, 34rem)";

/** Matches the `30rem` cap at a 16px root. */
const LANDING_DEMO_VIEWPORT_MAX_PX = 480;

/** Weekday header row above the scrollable grid (approximate, SSR-safe). */
const LANDING_DEMO_WEEK_HEADER_PX = 40;

/** SSR-safe hour-row height; matches first paint before ResizeObserver sync. */
function initialLandingDemoHourRowPx(hourCount: number): number {
  const floor = LANDING_DEMO_VIEWPORT_MAX_PX / hourCount;
  return Math.min(MAX_HOUR_ROW_PX, Math.max(MIN_HOUR_ROW_PX, floor));
}

function initialLandingDemoCalendarHeightPx(): number {
  return LANDING_DEMO_VIEWPORT_MAX_PX + LANDING_DEMO_WEEK_HEADER_PX;
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

/** Measure calendar shell height for mobile heading placement above center. */
export function useLandingDemoCalendarHeight(
  calendarRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
): CSSProperties {
  const [calHeight, setCalHeight] = useState(() =>
    initialLandingDemoCalendarHeightPx(),
  );

  useLayoutEffect(() => {
    if (!enabled) return;

    const node = calendarRef.current;
    if (!node) return;

    const sync = () => {
      const heightPx = node.offsetHeight;
      if (heightPx <= 0) return;
      setCalHeight(heightPx);
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(node);
    return () => ro.disconnect();
  }, [calendarRef, enabled]);

  if (!enabled) return {};

  return { "--landing-demo-cal-h": `${calHeight}px` } as CSSProperties;
}

/** Sticky / fallback shell for narrow viewports. */
export const LANDING_DEMO_MOBILE_STICKY_SHELL_CLASS =
  "max-lg:h-[100dvh] max-lg:overflow-hidden";

/** Offset section top padding so the sticky clip line aligns with the viewport. */
export const LANDING_DEMO_MOBILE_SECTION_OFFSET_CLASS =
  "max-lg:-mt-14 sm:max-lg:-mt-16";
