"use client";

import { MousePointer2 } from "lucide-react";
import { motion, useMotionValue } from "motion/react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  isLandingDemoPinnedBlock,
  LandingDemoPinBadge,
} from "@/components/landing/landing-demo-pin";
import {
  LANDING_DEMO_MOBILE_STICKY_SHELL_CLASS,
  LANDING_DEMO_VIEWPORT_HEIGHT,
  useLandingDemoRowPx,
} from "@/components/landing/landing-demo-layout";
import { computeTargetScrollProgress } from "@/components/landing/landing-demo-scroll-progress";
import { LandingWeekCalendarPreview } from "@/components/landing/LandingWeekCalendarPreview";
import {
  useHasMounted,
  usePrefersReducedMotion,
} from "@/components/landing/motion/usePrefersReducedMotion";
import {
  demoCandidateOpacity,
  demoCursorPath,
  demoCursorScale,
  demoHeldCardPath,
  demoHeldOpacity,
  demoSnapTargetOpacity,
  isDemoDragging,
  isDemoResolved,
  useLandingDemoGeometry,
} from "@/components/landing/use-landing-demo-geometry";
import { WeekCalendarGrid } from "@/components/planner/week-calendar/WeekCalendarGrid";
import { WeekCalendarShell } from "@/components/planner/week-calendar/WeekCalendarShell";
import { LANDING_PREVIEW_HOUR_AXIS } from "@/components/planner/week-calendar/axis-constants";
import {
  PLANNER_WEEKDAY_DAY_INDICES,
  PLANNER_WEEKDAY_GRID_MIN_WIDTH_REM,
} from "@/components/planner/week-calendar/constants";
import {
  LANDING_DEMO_CANDIDATE_SLOTS,
  LANDING_DEMO_DRAGGABLE_BLOCK,
  LANDING_DEMO_DRAGGABLE_KEY,
  LANDING_DEMO_RESOLVED_BLOCKS,
  LANDING_DEMO_SOURCE,
  LANDING_DEMO_START_BLOCKS,
} from "@/lib/planner/landing-preview-demo";
import { cn } from "@/lib/utils";

const SCENE_HEIGHT_VH = 220;

function LandingPlannerDemoLayout({
  heading,
  calendar,
  className,
}: {
  heading: ReactNode;
  calendar: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative max-lg:flex max-lg:flex-col",
        "lg:grid lg:grid-cols-3 lg:items-start lg:gap-8",
        className,
      )}
    >
      <aside className="lg:col-span-1 lg:pt-24">{heading}</aside>
      <div
        className={cn(
          "relative z-10 max-lg:mt-8 lg:col-span-2",
          "[&_#landing-week-calendar-preview]:shadow-xl",
        )}
        aria-hidden
      >
        {calendar}
      </div>
    </div>
  );
}

function slotOverlayStyle(
  slot: { startMinutes: number; endMinutes: number },
  layout: { startMin: number; totalMin: number; gridHeightPx: number },
) {
  const topPx =
    ((slot.startMinutes - layout.startMin) / layout.totalMin) *
    layout.gridHeightPx;
  const heightPx = Math.max(
    8,
    ((slot.endMinutes - slot.startMinutes) / layout.totalMin) *
      layout.gridHeightPx,
  );
  return { topPx, heightPx };
}

function LandingPlannerScrollDemoInner({ heading }: { heading: ReactNode }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const calendarWrapperRef = useRef<HTMLDivElement>(null);
  const overlayRootRef = useRef<HTMLDivElement>(null);
  const weekHeaderRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dayStripRef = useRef<HTMLDivElement>(null);

  const hourCount = LANDING_PREVIEW_HOUR_AXIS.length;
  const rowPx = useLandingDemoRowPx(viewportRef, hourCount);

  const readSceneProgress = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return 0;
    const rect = scene.getBoundingClientRect();
    return computeTargetScrollProgress(
      rect.height,
      rect.top,
      window.innerHeight,
    );
  }, []);

  // Fraction of the scene scrolled before the calendar pins (heading height on
  // mobile, ~0 on desktop). Animation progress is remapped to start at the pin.
  const pinFractionRef = useRef(0);
  /** Set once from layout; offsetTop is wrong after sticky / at raw≈0 or 1. */
  const pinFractionLockedRef = useRef<number | null>(null);
  const remapProgress = useCallback((raw: number) => {
    const p = pinFractionRef.current;
    if (p >= 1) return 0;
    return Math.min(1, Math.max(0, (raw - p) / (1 - p)));
  }, []);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [phase, setPhase] = useState<"start" | "resolved">("start");

  const demoSnapTarget = LANDING_DEMO_CANDIDATE_SLOTS.find(
    (slot) => slot.isSnapTarget,
  )!;
  const geometry = useLandingDemoGeometry(
    { overlayRootRef, weekHeaderRef, viewportRef, dayStripRef },
    rowPx,
    LANDING_DEMO_SOURCE,
    demoSnapTarget,
  );
  const geometryRef = useRef(geometry);

  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const cursorScale = useMotionValue(1);
  const heldX = useMotionValue(0);
  const heldY = useMotionValue(0);
  const heldWidth = useMotionValue(0);
  const heldHeight = useMotionValue(0);
  const heldOpacity = useMotionValue(0);

  const syncMotionFromProgress = useCallback(
    (progress: number) => {
      const g = geometryRef.current;
      if (!g) return;

      const cursor = demoCursorPath(progress, g);
      cursorX.set(cursor.x);
      cursorY.set(cursor.y);
      cursorScale.set(demoCursorScale(progress));

      const held = demoHeldCardPath(progress, g);
      heldX.set(held.x);
      heldY.set(held.y);
      heldWidth.set(held.width);
      heldHeight.set(held.height);
      heldOpacity.set(demoHeldOpacity(progress));
    },
    [
      cursorScale,
      cursorX,
      cursorY,
      heldHeight,
      heldOpacity,
      heldWidth,
      heldX,
      heldY,
    ],
  );

  const applyProgress = useCallback(
    (raw: number) => {
      const value = remapProgress(raw);
      setScrollProgress(value);
      setPhase(isDemoResolved(value) ? "resolved" : "start");
      syncMotionFromProgress(value);
    },
    [remapProgress, syncMotionFromProgress],
  );

  useLayoutEffect(() => {
    geometryRef.current = geometry;
    syncMotionFromProgress(remapProgress(readSceneProgress()));
  }, [geometry, readSceneProgress, remapProgress, syncMotionFromProgress]);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    const calendarWrapper = calendarWrapperRef.current;
    if (!scene || !calendarWrapper) return;

    // Pin offset is layout-only. Lock after first measure — offsetTop is wrong
    // once sticky engages or when the scene is scrolled to either end.
    const syncPinFraction = () => {
      if (pinFractionLockedRef.current !== null) {
        pinFractionRef.current = pinFractionLockedRef.current;
        return;
      }

      const scrollable = scene.offsetHeight - window.innerHeight;
      const fraction =
        scrollable > 0 ? calendarWrapper.offsetTop / scrollable : 0;
      const pin = Math.min(1, Math.max(0, fraction));
      pinFractionLockedRef.current = pin;
      pinFractionRef.current = pin;
    };

    const syncProgress = () => {
      applyProgress(readSceneProgress());
    };

    let raf = 0;
    const scheduleProgress = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncProgress);
    };

    syncPinFraction();
    syncProgress();
    window.addEventListener("scroll", scheduleProgress, { passive: true });
    const ro = new ResizeObserver(scheduleProgress);
    ro.observe(scene);
    window.addEventListener("resize", scheduleProgress);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", scheduleProgress);
      window.removeEventListener("resize", scheduleProgress);
    };
  }, [applyProgress, readSceneProgress]);

  const dragging = isDemoDragging(scrollProgress);
  const showCandidates = dragging && phase === "start";
  const blocks =
    phase === "resolved" ? LANDING_DEMO_RESOLVED_BLOCKS : LANDING_DEMO_START_BLOCKS;
  const candidateOpacity = demoCandidateOpacity(scrollProgress);
  const snapTargetOpacity = demoSnapTargetOpacity(scrollProgress);

  const calendar = (
    <div className="pointer-events-none">
      <WeekCalendarShell
        sectionId="landing-week-calendar-preview"
        isDragging={dragging}
        syncError={null}
        onClearSyncError={() => {}}
        scheduleFeasibilityError={null}
        onClearScheduleFeasibilityError={() => {}}
        swapError={null}
        onClearSwapError={() => {}}
        isRecalculatingSolutions={false}
        noSchedulesHelp={null}
        toolbar={null}
      >
        <div ref={overlayRootRef} className="relative">
          <WeekCalendarGrid
            blocks={blocks}
            visibleDayIndices={PLANNER_WEEKDAY_DAY_INDICES}
            rowPx={rowPx}
            hourAxis={LANDING_PREVIEW_HOUR_AXIS}
            viewportStyle={{ height: LANDING_DEMO_VIEWPORT_HEIGHT }}
            gridMinWidthRem={PLANNER_WEEKDAY_GRID_MIN_WIDTH_REM}
            weekHeaderRef={weekHeaderRef}
            viewportRef={viewportRef}
            dayStripRef={dayStripRef}
            enableMagicMove
            suspendMagicMoveLayout={dragging}
            blockDimmed={(block) =>
              block.key === LANDING_DEMO_DRAGGABLE_KEY &&
              dragging &&
              phase === "start"
            }
            renderBlockOverlay={(block) =>
              isLandingDemoPinnedBlock(block) ? <LandingDemoPinBadge /> : null
            }
            renderDayOverlay={(dayIndex, layout) => {
              if (!showCandidates || candidateOpacity <= 0) return null;

              const daySlots = LANDING_DEMO_CANDIDATE_SLOTS.filter(
                (slot) => slot.dayIndex === dayIndex,
              );
              if (daySlots.length === 0) return null;

              return (
                <>
                  {daySlots.map((slot) => {
                    const { topPx, heightPx } = slotOverlayStyle(slot, layout);
                    const isSnapTarget = slot.isSnapTarget === true;
                    const opacity = isSnapTarget
                      ? snapTargetOpacity
                      : candidateOpacity;

                    if (opacity <= 0) return null;

                    return (
                      <div
                        key={`${slot.dayIndex}-${slot.startMinutes}`}
                        className={cn(
                          "pointer-events-none absolute inset-x-0.5 z-[30] rounded-md border border-dashed",
                          isSnapTarget
                            ? "border-primary/70 bg-primary/10 ring-1 ring-primary/40"
                            : "border-muted-foreground/50 bg-muted/25",
                        )}
                        style={{
                          top: topPx,
                          height: heightPx,
                          opacity,
                        }}
                        aria-hidden
                      />
                    );
                  })}
                </>
              );
            }}
          />

          {geometry ? (
            <>
              <motion.div
                className="pointer-events-none absolute left-0 top-0 z-[50]"
                style={{
                  x: heldX,
                  y: heldY,
                  width: heldWidth,
                  height: heldHeight,
                  opacity: heldOpacity,
                }}
                aria-hidden
              >
                <div
                  className="h-full overflow-hidden rounded-md border border-border bg-card/95 py-1.5 pl-2 pr-1 shadow-lg backdrop-blur-sm"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor: LANDING_DEMO_DRAGGABLE_BLOCK.color,
                  }}
                >
                  <span className="line-clamp-3 font-mono text-[10px] font-medium leading-tight text-foreground">
                    {LANDING_DEMO_DRAGGABLE_BLOCK.label}
                  </span>
                  <span className="line-clamp-2 font-mono text-[9px] text-muted-foreground">
                    {LANDING_DEMO_DRAGGABLE_BLOCK.sublabel}
                  </span>
                </div>
              </motion.div>

              <motion.div
                className="pointer-events-none absolute left-0 top-0 z-[55] text-foreground drop-shadow-sm"
                style={{
                  x: cursorX,
                  y: cursorY,
                  scale: cursorScale,
                }}
                aria-hidden
              >
                <MousePointer2
                  className="size-5 fill-background stroke-[1.75]"
                  strokeWidth={1.75}
                />
              </motion.div>
            </>
          ) : null}
        </div>
      </WeekCalendarShell>
    </div>
  );

  return (
    <div
      ref={sceneRef}
      className="relative lg:-mt-28"
      style={{ height: `${SCENE_HEIGHT_VH}vh` }}
    >
      <div className="relative h-full lg:grid lg:grid-cols-3 lg:items-start lg:gap-8">
        <aside className="lg:col-span-1 lg:sticky lg:top-[10vh] lg:pt-24">
          {heading}
        </aside>
        <div
          ref={calendarWrapperRef}
          className={cn(
            "sticky top-0 z-10 lg:col-span-2 lg:top-[10vh]",
            "max-lg:flex max-lg:items-center max-lg:mt-8",
            LANDING_DEMO_MOBILE_STICKY_SHELL_CLASS,
            "[&_#landing-week-calendar-preview]:shadow-xl",
          )}
          aria-hidden
        >
          <div className="max-lg:w-full">{calendar}</div>
        </div>
      </div>
    </div>
  );
}

export function LandingPlannerScrollDemo({ heading }: { heading: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  const hasMounted = useHasMounted();

  if (!hasMounted || reducedMotion) {
    return (
      <LandingPlannerDemoLayout
        heading={heading}
        calendar={<LandingWeekCalendarPreview />}
      />
    );
  }

  return <LandingPlannerScrollDemoInner heading={heading} />;
}
