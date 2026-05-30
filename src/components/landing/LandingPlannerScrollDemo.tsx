"use client";

import { MousePointer2 } from "lucide-react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  isLandingDemoPinnedBlock,
  LandingDemoPinBadge,
} from "@/components/landing/landing-demo-pin";
import {
  LANDING_DEMO_MOBILE_SECTION_OFFSET_CLASS,
  LANDING_DEMO_MOBILE_STICKY_SHELL_CLASS,
  LANDING_DEMO_VIEWPORT_HEIGHT,
  LANDING_DEMO_VIEWPORT_HEIGHT_INTRO,
  useLandingDemoCalendarHeight,
  useLandingDemoRowPx,
} from "@/components/landing/landing-demo-layout";
import { LandingWeekCalendarPreview } from "@/components/landing/LandingWeekCalendarPreview";
import {
  demoCandidateOpacity,
  demoConflictTargetOpacity,
  demoCursorPath,
  demoCursorScale,
  demoHeldCardPath,
  demoHeldOpacity,
  isDemoDragging,
  isDemoDropping,
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
  LANDING_DEMO_CONFLICT_BLOCK_KEY,
  LANDING_DEMO_DRAGGABLE_BLOCK,
  LANDING_DEMO_DRAGGABLE_KEY,
  LANDING_DEMO_RESOLVED_BLOCKS,
  LANDING_DEMO_SOURCE,
  LANDING_DEMO_START_BLOCKS,
  LANDING_DEMO_TARGET,
} from "@/lib/planner/landing-preview-demo";
import { cn } from "@/lib/utils";

const SCENE_HEIGHT_VH = 220;

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function LandingPlannerDemoLayout({
  heading,
  calendar,
  mobileStickyActive,
  className,
}: {
  heading: ReactNode;
  calendar: ReactNode;
  mobileStickyActive: boolean;
  className?: string;
}) {
  const calendarMeasureRef = useRef<HTMLDivElement>(null);
  const layoutStyle = useLandingDemoCalendarHeight(
    calendarMeasureRef,
    mobileStickyActive,
  );

  return (
    <div
      className={cn(
        "relative",
        mobileStickyActive ? "max-lg:h-full" : "max-lg:flex max-lg:flex-col",
        "lg:grid lg:grid-cols-3 lg:items-start lg:gap-8",
        className,
      )}
      style={layoutStyle}
    >
      <aside
        className={cn(
          mobileStickyActive &&
            "max-lg:absolute max-lg:inset-x-0 max-lg:bottom-[calc(50%+var(--landing-demo-cal-h)/2+1rem)]",
          "lg:col-span-1 lg:pt-12",
        )}
      >
        {heading}
      </aside>
      <div
        ref={calendarMeasureRef}
        className={cn(
          "relative z-10 lg:col-span-2",
          mobileStickyActive &&
            "max-lg:absolute max-lg:inset-x-0 max-lg:top-1/2 max-lg:-translate-y-1/2",
          !mobileStickyActive && "max-lg:mt-8",
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
  const overlayRootRef = useRef<HTMLDivElement>(null);
  const weekHeaderRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dayStripRef = useRef<HTMLDivElement>(null);

  const hourCount = LANDING_PREVIEW_HOUR_AXIS.length;
  const rowPx = useLandingDemoRowPx(viewportRef, hourCount);

  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start start", "end end"],
  });

  const [scrollProgress, setScrollProgress] = useState(0);
  const [phase, setPhase] = useState<"start" | "resolved">("start");

  const geometry = useLandingDemoGeometry(
    { overlayRootRef, weekHeaderRef, viewportRef, dayStripRef },
    rowPx,
    LANDING_DEMO_SOURCE,
    LANDING_DEMO_TARGET,
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

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    setScrollProgress(value);
    setPhase(isDemoResolved(value) ? "resolved" : "start");
    syncMotionFromProgress(value);
  });

  useLayoutEffect(() => {
    geometryRef.current = geometry;
    syncMotionFromProgress(scrollYProgress.get());
  }, [geometry, scrollYProgress, syncMotionFromProgress]);

  const dragging = isDemoDragging(scrollProgress);
  const dropping = isDemoDropping(scrollProgress);
  const showCandidates = dragging && phase === "start";
  const blocks =
    phase === "resolved" ? LANDING_DEMO_RESOLVED_BLOCKS : LANDING_DEMO_START_BLOCKS;
  const candidateOpacity = demoCandidateOpacity(scrollProgress);
  const conflictTargetOpacity = demoConflictTargetOpacity(scrollProgress);
  const mobileStickyActive = scrollProgress > 0;
  const demoViewportHeight = mobileStickyActive
    ? LANDING_DEMO_VIEWPORT_HEIGHT
    : LANDING_DEMO_VIEWPORT_HEIGHT_INTRO;

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
            viewportStyle={{ height: demoViewportHeight }}
            gridMinWidthRem={PLANNER_WEEKDAY_GRID_MIN_WIDTH_REM}
            weekHeaderRef={weekHeaderRef}
            viewportRef={viewportRef}
            dayStripRef={dayStripRef}
            blockClassName={(block) => {
              if (
                block.key === LANDING_DEMO_DRAGGABLE_KEY &&
                dragging &&
                phase === "start"
              ) {
                return "opacity-0";
              }
              if (
                block.key === LANDING_DEMO_CONFLICT_BLOCK_KEY &&
                dropping &&
                phase === "start"
              ) {
                return "ring-2 ring-destructive/80 ring-offset-1 ring-offset-card";
              }
              return undefined;
            }}
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
                    const isConflictTarget = slot.conflict === true;
                    const opacity = isConflictTarget
                      ? conflictTargetOpacity
                      : candidateOpacity;

                    if (opacity <= 0) return null;

                    return (
                      <div
                        key={`${slot.dayIndex}-${slot.startMinutes}`}
                        className={cn(
                          "pointer-events-none absolute inset-x-0.5 z-[15] rounded-md border-2 border-dashed",
                          isConflictTarget
                            ? "border-destructive/60 bg-destructive/10"
                            : "border-primary/50 bg-primary/5",
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
                  <span className="line-clamp-2 font-mono text-[10px] font-medium leading-tight text-foreground">
                    {LANDING_DEMO_DRAGGABLE_BLOCK.label}
                  </span>
                  <span className="line-clamp-1 font-mono text-[9px] text-muted-foreground">
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
      className={cn(
        "relative lg:-mt-28",
        mobileStickyActive && LANDING_DEMO_MOBILE_SECTION_OFFSET_CLASS,
      )}
      style={{ height: `${SCENE_HEIGHT_VH}vh` }}
    >
      <div
        className={cn(
          "sticky lg:top-[10vh]",
          mobileStickyActive && "max-lg:top-0",
          mobileStickyActive && LANDING_DEMO_MOBILE_STICKY_SHELL_CLASS,
        )}
      >
        <LandingPlannerDemoLayout
          heading={heading}
          calendar={calendar}
          mobileStickyActive={mobileStickyActive}
        />
      </div>
    </div>
  );
}

export function LandingPlannerScrollDemo({ heading }: { heading: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const isClient = useIsClient();

  if (!isClient || reducedMotion) {
    return (
      <LandingPlannerDemoLayout
        heading={heading}
        calendar={<LandingWeekCalendarPreview />}
        mobileStickyActive={false}
      />
    );
  }

  return <LandingPlannerScrollDemoInner heading={heading} />;
}
