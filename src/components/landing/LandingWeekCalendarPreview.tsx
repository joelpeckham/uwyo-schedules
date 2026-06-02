"use client";

import { useInView } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  LANDING_DEMO_VIEWPORT_HEIGHT,
  useLandingDemoRowPx,
} from "@/components/landing/landing-demo-layout";
import { usePrefersReducedMotion } from "@/components/landing/motion/usePrefersReducedMotion";
import {
  isLandingDemoPinnedBlock,
  LandingDemoPinBadge,
} from "@/components/landing/landing-demo-pin";
import { WeekCalendarGrid } from "@/components/planner/week-calendar/WeekCalendarGrid";
import { WeekCalendarShell } from "@/components/planner/week-calendar/WeekCalendarShell";
import { LANDING_PREVIEW_HOUR_AXIS } from "@/components/planner/week-calendar/axis-constants";
import {
  PLANNER_WEEKDAY_DAY_INDICES,
  PLANNER_WEEKDAY_GRID_MIN_WIDTH_REM,
} from "@/components/planner/week-calendar/constants";
import { LANDING_DEMO_RESOLVED_BLOCKS } from "@/lib/planner/landing-preview-demo";

const BLOCK_REVEAL_MS = 120;

export function LandingWeekCalendarPreview() {
  const hourCount = LANDING_PREVIEW_HOUR_AXIS.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rowPx = useLandingDemoRowPx(viewportRef, hourCount);
  const isInView = useInView(containerRef, { once: true, margin: "-10% 0px" });
  const reducedMotion = usePrefersReducedMotion();
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    if (reducedMotion || !isInView) {
      return;
    }

    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      setRevealedCount(count);
      if (count >= LANDING_DEMO_RESOLVED_BLOCKS.length) {
        window.clearInterval(timer);
      }
    }, BLOCK_REVEAL_MS);

    return () => window.clearInterval(timer);
  }, [isInView, reducedMotion]);

  const blockCount = reducedMotion
    ? LANDING_DEMO_RESOLVED_BLOCKS.length
    : revealedCount;

  const visibleBlocks = useMemo(
    () => LANDING_DEMO_RESOLVED_BLOCKS.slice(0, blockCount),
    [blockCount],
  );

  return (
    <div ref={containerRef} className="pointer-events-none">
      <WeekCalendarShell
        sectionId="landing-week-calendar-preview"
        isDragging={false}
        isRecalculatingSolutions={false}
        noSchedulesHelp={null}
        toolbar={null}
      >
        <WeekCalendarGrid
          blocks={visibleBlocks}
          visibleDayIndices={PLANNER_WEEKDAY_DAY_INDICES}
          rowPx={rowPx}
          hourAxis={LANDING_PREVIEW_HOUR_AXIS}
          viewportStyle={{ height: LANDING_DEMO_VIEWPORT_HEIGHT }}
          gridMinWidthRem={PLANNER_WEEKDAY_GRID_MIN_WIDTH_REM}
          viewportRef={viewportRef}
          renderBlockOverlay={(block) =>
            isLandingDemoPinnedBlock(block) ? <LandingDemoPinBadge /> : null
          }
        />
      </WeekCalendarShell>
    </div>
  );
}
