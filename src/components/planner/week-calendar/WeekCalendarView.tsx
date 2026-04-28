"use client";

import {
  type CSSProperties,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from "react";
import {
  calendarBlockPaddingPx,
  calendarSecondaryTier,
  calendarTitleFontPx,
  formatHour,
} from "./block-metrics";
import {
  CALENDAR_HOUR_AXIS,
  DAY_LABELS,
} from "./axis-constants";
import { groupBlocksByDay } from "./group-by-day";
import type { CalendarBlock } from "@/lib/planner/data";
import { cn } from "@/lib/utils";

export type WeekCalendarLayout = {
  /** First minute of the visible day (e.g. 4 a.m. = 240). */
  startMin: number;
  /** Total minutes rendered (= hourCount * 60). */
  totalMin: number;
  /** Pixel height of the day strip (= hourCount * rowPx). */
  gridHeightPx: number;
};

export type CalendarBlockLayout = {
  block: CalendarBlock;
  topPx: number;
  heightPx: number;
};

type DivPointerHandlers = Pick<
  ComponentProps<"div">,
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "onPointerCancel"
  | "onKeyDown"
>;

export type WeekCalendarViewProps = {
  blocks: readonly CalendarBlock[];
  visibleDayIndices: readonly number[];
  rowPx: number;
  /** Inclusive hour numbers, top to bottom. Defaults to the planner's full axis. */
  hourAxis?: readonly number[];
  /** Inline style applied to the scrollable viewport (e.g. fixed height). */
  viewportStyle?: CSSProperties;
  className?: string;
  weekHeaderRef?: Ref<HTMLDivElement | null>;
  viewportRef?: Ref<HTMLDivElement | null>;
  dayStripRef?: Ref<HTMLDivElement | null>;
  /** Extra class on each day column (e.g. busy-mode crosshair). */
  dayColumnClassName?: string;
  /** Per-day pointer handlers (e.g. blackout drag). */
  dayColumnHandlers?: (dayIndex: number) => DivPointerHandlers;
  /** Per-day overlay slot for blackouts, ghosts, drag previews. */
  renderDayOverlay?: (
    dayIndex: number,
    layout: WeekCalendarLayout,
  ) => ReactNode;
  /** Per-block pointer handlers; signals "interactive" mode (role=button). */
  blockHandlers?: (block: CalendarBlock) => DivPointerHandlers;
  /** Per-block overlay (e.g. pin button) rendered inside the block. */
  renderBlockOverlay?: (
    block: CalendarBlock,
    layout: CalendarBlockLayout,
  ) => ReactNode;
  /** Per-block extra class (e.g. opacity-35 for the drag source). */
  blockClassName?: (block: CalendarBlock) => string | undefined;
  /** Floating overlay rendered inside the scrollable viewport (drag float). */
  viewportFloatingOverlay?: ReactNode;
  /** Min width of the inner grid in rem; auto-derived from day count when omitted. */
  gridMinWidthRem?: number;
};

export function WeekCalendarView({
  blocks,
  visibleDayIndices,
  rowPx,
  hourAxis = CALENDAR_HOUR_AXIS,
  viewportStyle,
  className,
  weekHeaderRef,
  viewportRef,
  dayStripRef,
  dayColumnClassName,
  dayColumnHandlers,
  renderDayOverlay,
  blockHandlers,
  renderBlockOverlay,
  blockClassName,
  viewportFloatingOverlay,
  gridMinWidthRem,
}: WeekCalendarViewProps) {
  const startHour = hourAxis[0] ?? 0;
  const startMin = startHour * 60;
  const hourCount = hourAxis.length;
  const totalMin = hourCount * 60;
  const gridHeightPx = hourCount * rowPx;

  const minWidthRem =
    gridMinWidthRem ??
    (visibleDayIndices.length === 7
      ? 40.5
      : 3.5 + visibleDayIndices.length * 4.5);

  const blocksByDay = groupBlocksByDay(blocks);
  const layout: WeekCalendarLayout = { startMin, totalMin, gridHeightPx };

  return (
    <div
      className={cn("flex flex-col", className)}
      style={{ minWidth: `max(100%, ${minWidthRem}rem)` }}
    >
      <div
        ref={weekHeaderRef}
        className="flex shrink-0 border-b border-border bg-muted/30"
      >
        <div className="w-14 shrink-0" aria-hidden />
        {visibleDayIndices.map((dayIndex) => (
          <div
            key={dayIndex}
            className="min-w-[4.5rem] flex-1 border-l border-border py-2 text-center font-mono text-xs font-medium text-muted-foreground"
          >
            {DAY_LABELS[dayIndex]}
          </div>
        ))}
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-0 touch-none overflow-y-auto overscroll-y-contain"
        style={viewportStyle}
      >
        <div
          className="flex"
          style={{ minWidth: `max(100%, ${minWidthRem}rem)` }}
        >
          <div className="flex w-14 shrink-0 flex-col border-r border-border bg-muted/20">
            {hourAxis.map((h) => (
              <div
                key={h}
                className="flex items-start justify-end pr-1.5 font-mono text-[10px] leading-tight text-muted-foreground"
                style={{ height: rowPx, minHeight: rowPx }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          <div ref={dayStripRef} className="flex min-w-0 flex-1">
            {visibleDayIndices.map((dayIndex) => {
              const handlers = dayColumnHandlers?.(dayIndex) ?? {};
              return (
                <div
                  key={dayIndex}
                  role="presentation"
                  className={cn(
                    "relative min-w-[4.5rem] flex-1 border-l border-border",
                    dayColumnClassName,
                  )}
                  style={{ height: gridHeightPx, minHeight: gridHeightPx }}
                  {...handlers}
                >
                  <div className="pointer-events-none absolute inset-0 flex flex-col">
                    {hourAxis.map((h) => (
                      <div
                        key={h}
                        className="border-b border-border/80"
                        style={{ height: rowPx, minHeight: rowPx }}
                      />
                    ))}
                  </div>
                  {renderDayOverlay?.(dayIndex, layout)}
                  {(blocksByDay.get(dayIndex) ?? []).map((b) => {
                    const topPx =
                      ((b.startMinutes - startMin) / totalMin) * gridHeightPx;
                    const rawH =
                      ((b.endMinutes - b.startMinutes) / totalMin) *
                      gridHeightPx;
                    const heightPx = Math.max(8, rawH);
                    const blockLayout: CalendarBlockLayout = {
                      block: b,
                      topPx,
                      heightPx,
                    };
                    const pad = calendarBlockPaddingPx(heightPx);
                    const titlePx = calendarTitleFontPx(heightPx);
                    const secondaryPx = Math.max(7, titlePx - 1);
                    const tier = calendarSecondaryTier(heightPx);
                    const loc = b.sublabel.trim();
                    const inst = b.instructorSublabel?.trim() ?? "";
                    const titleAttr = [b.label, inst, loc]
                      .filter(Boolean)
                      .join(" · ");
                    let showInstructor = false;
                    let showLocation = false;
                    if (tier === "both") {
                      showInstructor = inst.length > 0;
                      showLocation = loc.length > 0;
                    } else if (tier === "one") {
                      if (inst.length > 0) showInstructor = true;
                      else if (loc.length > 0) showLocation = true;
                    }
                    const titleClampClass =
                      tier === "none"
                        ? "truncate"
                        : "line-clamp-2 min-h-0 break-words";
                    const blockHandlerProps = blockHandlers?.(b);
                    const isInteractive = blockHandlerProps != null;
                    const extraClass = blockClassName?.(b);
                    return (
                      <div
                        key={b.key}
                        role={isInteractive ? "button" : undefined}
                        tabIndex={isInteractive ? 0 : undefined}
                        title={titleAttr}
                        aria-label={isInteractive ? titleAttr : undefined}
                        className={cn(
                          "absolute left-0.5 right-0.5 z-[20] overflow-hidden rounded-md border border-border bg-card text-left shadow-sm outline-none",
                          "flex min-h-0 flex-col justify-start gap-0.5 border-l-[4px]",
                          isInteractive &&
                            "touch-none cursor-pointer active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          extraClass,
                        )}
                        style={{
                          top: topPx,
                          height: heightPx,
                          borderLeftColor: b.color,
                          paddingTop: pad,
                          paddingBottom: pad,
                          paddingLeft: Math.min(10, pad + 4),
                          paddingRight: Math.min(8, pad + 2),
                        }}
                        {...(blockHandlerProps ?? {})}
                      >
                        {renderBlockOverlay?.(b, blockLayout)}
                        <span
                          className={cn(
                            "min-w-0 font-mono font-medium leading-tight text-foreground",
                            titleClampClass,
                          )}
                          style={{ fontSize: titlePx }}
                        >
                          {b.label}
                        </span>
                        {showInstructor ? (
                          <span
                            className="line-clamp-1 min-w-0 font-mono leading-tight text-muted-foreground"
                            style={{ fontSize: secondaryPx }}
                          >
                            {inst}
                          </span>
                        ) : null}
                        {showLocation ? (
                          <span
                            className="line-clamp-1 min-w-0 font-mono leading-tight text-muted-foreground"
                            style={{ fontSize: secondaryPx }}
                          >
                            {loc}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        {viewportFloatingOverlay}
      </div>
    </div>
  );
}
