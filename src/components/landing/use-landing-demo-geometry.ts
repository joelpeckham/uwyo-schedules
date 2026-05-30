"use client";

import {
  type RefObject,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import { LANDING_PREVIEW_HOUR_AXIS } from "@/components/planner/week-calendar/axis-constants";
import { PLANNER_WEEKDAY_DAY_INDICES } from "@/components/planner/week-calendar/constants";
import type { CalendarBlock } from "@/lib/planner/data";

type BlockRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

type LandingDemoGeometry = {
  blockRect: (block: Pick<CalendarBlock, "dayIndex" | "startMinutes" | "endMinutes">) => BlockRect;
  sourceRect: BlockRect;
  targetRect: BlockRect;
  cursorRest: { x: number; y: number };
};

type MeasureRefs = {
  overlayRootRef: RefObject<HTMLDivElement | null>;
  weekHeaderRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  dayStripRef: RefObject<HTMLDivElement | null>;
};

function computeBlockRect(
  dayIndex: number,
  startMinutes: number,
  endMinutes: number,
  overlayRect: DOMRect,
  stripLeft: number,
  colWidth: number,
  headerHeight: number,
  viewportHeight: number,
  startMin: number,
  totalMin: number,
): BlockRect {
  const colIndex = PLANNER_WEEKDAY_DAY_INDICES.indexOf(
    dayIndex as (typeof PLANNER_WEEKDAY_DAY_INDICES)[number],
  );
  if (colIndex < 0) {
    return {
      left: stripLeft,
      top: headerHeight,
      width: colWidth,
      height: 8,
      centerX: stripLeft + colWidth / 2,
      centerY: headerHeight + 4,
    };
  }
  const inset = 2;
  const left = stripLeft + colIndex * colWidth + inset;
  const width = Math.max(8, colWidth - inset * 2);
  const top =
    headerHeight +
    ((startMinutes - startMin) / totalMin) * viewportHeight +
    inset;
  const height = Math.max(
    8,
    ((endMinutes - startMinutes) / totalMin) * viewportHeight - inset * 2,
  );
  return {
    left,
    top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
}

export function useLandingDemoGeometry(
  refs: MeasureRefs,
  rowPx: number,
  sourceBlock: Pick<CalendarBlock, "dayIndex" | "startMinutes" | "endMinutes">,
  targetBlock: Pick<CalendarBlock, "dayIndex" | "startMinutes" | "endMinutes">,
): LandingDemoGeometry | null {
  const [tick, setTick] = useState(0);

  useLayoutEffect(() => {
    const { overlayRootRef, weekHeaderRef, viewportRef, dayStripRef } = refs;
    const nodes = [
      overlayRootRef.current,
      weekHeaderRef.current,
      viewportRef.current,
      dayStripRef.current,
    ].filter(Boolean);

    if (nodes.length === 0) return;

    const ro = new ResizeObserver(() => setTick((n) => n + 1));
    for (const node of nodes) {
      ro.observe(node as Element);
    }
    return () => ro.disconnect();
  }, [refs]);

  return useMemo(() => {
    void tick;
    const overlay = refs.overlayRootRef.current;
    const header = refs.weekHeaderRef.current;
    const viewport = refs.viewportRef.current;
    const strip = refs.dayStripRef.current;
    if (!overlay || !header || !viewport || !strip) return null;

    const overlayRect = overlay.getBoundingClientRect();
    const stripRect = strip.getBoundingClientRect();
    const stripLeft = stripRect.left - overlayRect.left;
    const colWidth = stripRect.width / PLANNER_WEEKDAY_DAY_INDICES.length;
    const headerHeight = header.clientHeight;
    const viewportHeight = viewport.clientHeight;
    const startMin = (LANDING_PREVIEW_HOUR_AXIS[0] ?? 0) * 60;
    const totalMin = LANDING_PREVIEW_HOUR_AXIS.length * 60;
    void rowPx;

    const blockRect = (
      block: Pick<CalendarBlock, "dayIndex" | "startMinutes" | "endMinutes">,
    ) =>
      computeBlockRect(
        block.dayIndex,
        block.startMinutes,
        block.endMinutes,
        overlayRect,
        stripLeft,
        colWidth,
        headerHeight,
        viewportHeight,
        startMin,
        totalMin,
      );

    const sourceRect = blockRect(sourceBlock);
    const targetRect = blockRect(targetBlock);

    return {
      blockRect,
      sourceRect,
      targetRect,
      cursorRest: {
        x: sourceRect.centerX + 48,
        y: Math.max(12, sourceRect.top - 28),
      },
    };
  }, [refs, rowPx, sourceBlock, targetBlock, tick]);
}

/** Piecewise linear interpolation for scroll-driven keyframes. */
export function lerpKeyframes(
  progress: number,
  stops: readonly number[],
  values: readonly number[],
): number {
  if (stops.length !== values.length || stops.length === 0) return 0;
  if (progress <= stops[0]) return values[0];
  const last = stops.length - 1;
  if (progress >= stops[last]) return values[last];

  for (let i = 0; i < last; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (progress >= a && progress <= b) {
      const t = (progress - a) / (b - a);
      return values[i] + t * (values[i + 1] - values[i]);
    }
  }
  return values[last];
}

const DEMO_SCROLL_STOPS = {
  approach: 0.12,
  grab: 0.2,
  dragEnd: 0.55,
  drop: 0.62,
  settle: 1,
} as const;

export function demoCursorPath(
  progress: number,
  geometry: LandingDemoGeometry,
): { x: number; y: number } {
  const { sourceRect, targetRect, cursorRest } = geometry;
  const stops = [
    0,
    DEMO_SCROLL_STOPS.approach,
    DEMO_SCROLL_STOPS.grab,
    DEMO_SCROLL_STOPS.dragEnd,
    DEMO_SCROLL_STOPS.drop,
    DEMO_SCROLL_STOPS.settle,
  ];
  const x = lerpKeyframes(progress, stops, [
    cursorRest.x,
    sourceRect.centerX + 10,
    sourceRect.centerX + 10,
    targetRect.centerX + 10,
    targetRect.centerX + 10,
    targetRect.centerX + 36,
  ]);
  const y = lerpKeyframes(progress, stops, [
    cursorRest.y,
    sourceRect.centerY + 8,
    sourceRect.centerY + 8,
    targetRect.centerY + 8,
    targetRect.centerY + 8,
    targetRect.centerY - 20,
  ]);
  return { x, y };
}

export function demoHeldCardPath(
  progress: number,
  geometry: LandingDemoGeometry,
): { x: number; y: number; width: number; height: number } {
  const { sourceRect, targetRect } = geometry;
  const grabOffsetX = 12;
  const grabOffsetY = 10;
  const stops = [
    DEMO_SCROLL_STOPS.grab,
    DEMO_SCROLL_STOPS.dragEnd,
    DEMO_SCROLL_STOPS.drop,
    DEMO_SCROLL_STOPS.settle,
  ];
  const x = lerpKeyframes(progress, stops, [
    sourceRect.left + grabOffsetX,
    targetRect.left + grabOffsetX,
    targetRect.left + grabOffsetX,
    targetRect.left + grabOffsetX,
  ]);
  const y = lerpKeyframes(progress, stops, [
    sourceRect.top + grabOffsetY,
    targetRect.top + grabOffsetY,
    targetRect.top + grabOffsetY,
    targetRect.top + grabOffsetY,
  ]);
  return {
    x,
    y,
    width: sourceRect.width,
    height: sourceRect.height,
  };
}

export function demoHeldOpacity(progress: number): number {
  return lerpKeyframes(progress, [0.18, 0.2, 0.58, 0.62], [0, 1, 1, 0]);
}

export function demoCursorScale(progress: number): number {
  return lerpKeyframes(progress, [0.17, 0.2, 0.23], [1, 0.82, 1]);
}

export function demoCandidateOpacity(progress: number): number {
  return lerpKeyframes(progress, [0.18, 0.24, 0.54, 0.62], [0, 0.55, 0.55, 0]);
}

/** Stronger highlight on the snapped destination slot as the cursor nears. */
export function demoSnapTargetOpacity(progress: number): number {
  const base = demoCandidateOpacity(progress);
  if (base <= 0) return 0;
  const boost = lerpKeyframes(progress, [0.35, 0.55], [0, 0.45]);
  return Math.min(1, base + boost);
}

export function isDemoDragging(progress: number): boolean {
  return progress > 0.2 && progress < 0.62;
}

export function isDemoResolved(progress: number): boolean {
  return progress >= 0.62;
}
