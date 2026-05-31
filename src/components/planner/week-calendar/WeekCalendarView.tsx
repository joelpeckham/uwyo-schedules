"use client";

import {
  memo,
  useMemo,
  type CSSProperties,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  calendarBlockCornerInsetPx,
  calendarBlockPaddingPx,
  calendarSecondaryTier,
  calendarTitleFontPx,
  likelyExamFooterPaddingPx,
  formatHour,
} from "./block-metrics";
import {
  CALENDAR_HOUR_AXIS,
  DAY_LABELS,
} from "./axis-constants";
import { groupBlocksByDay } from "./group-by-day";
import { buildMagicMoveIdMap } from "./magic-move";
import type { CalendarBlock } from "@/lib/planner/data";
import {
  LIKELY_EXAM_DISCLOSURE,
  LIKELY_EXAM_PATTERN_DISCLOSURE,
  likelyExamShortLabel,
} from "@/lib/sections/parse-exam-reservations";
import { cn } from "@/lib/utils";

type WeekCalendarLayout = {
  /** First minute of the visible day (e.g. 4 a.m. = 240). */
  startMin: number;
  /** Total minutes rendered (= hourCount * 60). */
  totalMin: number;
  /** Pixel height of the day strip (= hourCount * rowPx). */
  gridHeightPx: number;
};

type CalendarBlockLayout = {
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
  /** When true, block renders at 35% opacity (framer-safe when magic move is on). */
  blockDimmed?: (block: CalendarBlock) => boolean;
  /** Floating overlay rendered inside the scrollable viewport (drag float). */
  viewportFloatingOverlay?: ReactNode;
  /** Min width of the inner grid in rem; auto-derived from day count when omitted. */
  gridMinWidthRem?: number;
  /** When true, the day column is visually de-emphasized (empty weekend). */
  isDayMuted?: (dayIndex: number) => boolean;
  /** Keynote-style shared-layout animation when the solve changes. */
  enableMagicMove?: boolean;
  /** When true, keep magic-move wrappers but skip layout morph (e.g. during block drag). */
  suspendMagicMoveLayout?: boolean;
  /** When true, apply block updates instantly (e.g. after drag-drop commit). */
  instantBlockUpdate?: boolean;
  /** Override magic-move layout ids (e.g. landing demo Thu→Fri morph). */
  magicIdForBlock?: (block: CalendarBlock) => string;
};

type BackToBackChip = {
  key: string;
  atMinute: number;
  label: string;
  title: string;
};

const BACK_TO_BACK_GAP_THRESHOLD_MIN = 15;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const MAGIC_MOVE_TRANSITION = {
  layout: { duration: 0.2, ease: EASE_OUT },
  opacity: { duration: 0.15 },
} as const;

function computeBackToBackChips(
  blocksByDay: Map<number, CalendarBlock[]>,
): Map<number, BackToBackChip[]> {
  const out = new Map<number, BackToBackChip[]>();
  for (const [dayIndex, list] of blocksByDay.entries()) {
    const sorted = [...list].sort((a, b) => a.startMinutes - b.startMinutes);
    const chips: BackToBackChip[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (b.startMinutes <= a.endMinutes) continue;
      if (a.plannerItemId === b.plannerItemId) continue;
      const gap = b.startMinutes - a.endMinutes;
      if (gap >= BACK_TO_BACK_GAP_THRESHOLD_MIN) continue;
      const fromBuilding = a.buildingShort?.trim();
      const toBuilding = b.buildingShort?.trim();
      if (!fromBuilding || !toBuilding) continue;
      if (fromBuilding === toBuilding) continue;
      const fromShort = shortenBuilding(fromBuilding);
      const toShort = shortenBuilding(toBuilding);
      chips.push({
        key: `${a.key}->${b.key}`,
        atMinute: a.endMinutes + gap / 2,
        label: `${gap} min · ${fromShort} → ${toShort}`,
        title: `${gap}-minute walk from ${fromBuilding} to ${toBuilding}`,
      });
    }
    if (chips.length > 0) out.set(dayIndex, chips);
  }
  return out;
}

function shortenBuilding(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 14) return trimmed;
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first.length > 1 ? first : trimmed.slice(0, 12);
}

function WeekCalendarViewInner({
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
  blockDimmed,
  viewportFloatingOverlay,
  gridMinWidthRem,
  isDayMuted,
  enableMagicMove = false,
  suspendMagicMoveLayout = false,
  instantBlockUpdate = false,
  magicIdForBlock: magicIdForBlockProp,
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

  const backToBackChipsByDay = computeBackToBackChips(blocksByDay);

  const magicIdMap = useMemo(
    () =>
      enableMagicMove && magicIdForBlockProp == null
        ? buildMagicMoveIdMap(blocks)
        : null,
    [blocks, enableMagicMove, magicIdForBlockProp],
  );

  const magicIdForBlock = useMemo(() => {
    if (!enableMagicMove) return undefined;
    if (magicIdForBlockProp) return magicIdForBlockProp;
    if (!magicIdMap) return undefined;
    return (block: CalendarBlock) => magicIdMap.get(block.key) ?? block.key;
  }, [enableMagicMove, magicIdForBlockProp, magicIdMap]);

  const dayStrip = (
    <div ref={dayStripRef} className="flex min-w-0 flex-1">
      {visibleDayIndices.map((dayIndex) => (
        <WeekCalendarDayColumn
          key={dayIndex}
          dayIndex={dayIndex}
          dayBlocks={blocksByDay.get(dayIndex) ?? []}
          backToBackChips={backToBackChipsByDay.get(dayIndex) ?? []}
          rowPx={rowPx}
          hourAxis={hourAxis}
          layout={layout}
          gridHeightPx={gridHeightPx}
          isMuted={isDayMuted?.(dayIndex) ?? false}
          dayColumnClassName={dayColumnClassName}
          dayColumnHandlers={dayColumnHandlers?.(dayIndex)}
          renderDayOverlay={renderDayOverlay}
          blockHandlers={blockHandlers}
          renderBlockOverlay={renderBlockOverlay}
          blockClassName={blockClassName}
          blockDimmed={blockDimmed}
          enableMagicMove={enableMagicMove}
          suspendMagicMoveLayout={suspendMagicMoveLayout}
          instantBlockUpdate={instantBlockUpdate}
          magicIdForBlock={magicIdForBlock}
        />
      ))}
    </div>
  );

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
            className={cn(
              "min-w-[4.5rem] flex-1 border-l border-border py-2 text-center font-mono text-xs font-medium text-muted-foreground",
              isDayMuted?.(dayIndex) && "opacity-40",
            )}
          >
            {DAY_LABELS[dayIndex]}
          </div>
        ))}
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-0 touch-none select-none overflow-y-auto overscroll-y-contain"
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

          {enableMagicMove ? (
            <LayoutGroup>{dayStrip}</LayoutGroup>
          ) : (
            dayStrip
          )}
        </div>
        {viewportFloatingOverlay}
      </div>
    </div>
  );
}

export const WeekCalendarView = memo(WeekCalendarViewInner);

type WeekCalendarDayColumnProps = {
  dayIndex: number;
  dayBlocks: readonly CalendarBlock[];
  backToBackChips: BackToBackChip[];
  rowPx: number;
  hourAxis: readonly number[];
  layout: WeekCalendarLayout;
  gridHeightPx: number;
  isMuted: boolean;
  dayColumnClassName?: string;
  dayColumnHandlers?: DivPointerHandlers;
  renderDayOverlay?: WeekCalendarViewProps["renderDayOverlay"];
  blockHandlers?: WeekCalendarViewProps["blockHandlers"];
  renderBlockOverlay?: WeekCalendarViewProps["renderBlockOverlay"];
  blockClassName?: WeekCalendarViewProps["blockClassName"];
  blockDimmed?: WeekCalendarViewProps["blockDimmed"];
  enableMagicMove?: boolean;
  suspendMagicMoveLayout?: boolean;
  instantBlockUpdate?: boolean;
  magicIdForBlock?: (block: CalendarBlock) => string;
};

const WeekCalendarDayColumn = memo(function WeekCalendarDayColumn({
  dayIndex,
  dayBlocks,
  backToBackChips,
  rowPx,
  hourAxis,
  layout,
  gridHeightPx,
  isMuted,
  dayColumnClassName,
  dayColumnHandlers,
  renderDayOverlay,
  blockHandlers,
  renderBlockOverlay,
  blockClassName,
  blockDimmed,
  enableMagicMove = false,
  suspendMagicMoveLayout = false,
  instantBlockUpdate = false,
  magicIdForBlock,
}: WeekCalendarDayColumnProps) {
  const { startMin, totalMin } = layout;
  const BlockTag = enableMagicMove ? motion.div : "div";

  const blockNodes = dayBlocks.map((b) => {
    const topPx =
      ((b.startMinutes - startMin) / totalMin) * gridHeightPx;
    const rawH =
      ((b.endMinutes - b.startMinutes) / totalMin) * gridHeightPx;
    const heightPx = Math.max(8, rawH);
    const blockLayout: CalendarBlockLayout = {
      block: b,
      topPx,
      heightPx,
    };
    const pad = calendarBlockPaddingPx(heightPx);
    const cornerInset = calendarBlockCornerInsetPx(heightPx);
    const titlePx = calendarTitleFontPx(heightPx);
    const secondaryPx = Math.max(7, titlePx - 1);
    const tier = calendarSecondaryTier(heightPx);
    const loc = b.sublabel.trim();
    const instRaw = b.instructorSublabel?.trim() ?? "";
    const seats = b.seatsAvailable;
    const seatChip =
      typeof seats === "number" && Number.isFinite(seats)
        ? `${Math.max(0, seats)} seat${seats === 1 ? "" : "s"}`
        : "";
    const inst =
      instRaw && seatChip
        ? `${instRaw} · ${seatChip}`
        : instRaw || seatChip;
    const examNote = b.likelyExam
      ? b.likelyExamInferenceSource === "pattern"
        ? LIKELY_EXAM_PATTERN_DISCLOSURE
        : LIKELY_EXAM_DISCLOSURE
      : "";
    const examShort =
      b.likelyExam && b.likelyExamLabel
        ? b.likelyExamLabel
        : b.likelyExam
          ? likelyExamShortLabel("exam")
          : "";
    const titleAttr = [b.label, inst, loc, examNote]
      .filter(Boolean)
      .join(" · ");
    let showInstructor = false;
    let showLocation = false;
    if (!b.likelyExam) {
      if (tier === "both") {
        showInstructor = inst.length > 0;
        showLocation = loc.length > 0;
      } else if (tier === "one") {
        if (inst.length > 0) showInstructor = true;
        else if (loc.length > 0) showLocation = true;
      }
    } else if (tier !== "none") {
      showInstructor = inst.length > 0;
    }
    const examFooterPad = b.likelyExam
      ? likelyExamFooterPaddingPx(heightPx)
      : 0;
    const titleClampClass =
      tier === "none" || b.likelyExam
        ? "line-clamp-1 min-h-0 truncate"
        : "line-clamp-2 min-h-0 break-words";
    const blockHandlerProps = blockHandlers?.(b);
    const isInteractive = blockHandlerProps != null;
    const extraClass = blockClassName?.(b);
    const dimmed = blockDimmed?.(b) ?? false;
    const magicId = magicIdForBlock?.(b) ?? b.key;
    const instant = enableMagicMove && instantBlockUpdate;

    return (
      <BlockTag
        key={enableMagicMove ? magicId : b.key}
        {...(enableMagicMove
          ? {
              layoutId: instant ? undefined : magicId,
              layout:
                instant || suspendMagicMoveLayout ? false : ("position" as const),
              initial: instant ? false : { opacity: 0 },
              animate: { opacity: dimmed ? 0.35 : 1 },
              ...(instant ? {} : { exit: { opacity: 0 } }),
              transition: instant ? { duration: 0 } : MAGIC_MOVE_TRANSITION,
            }
          : {})}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        title={titleAttr}
        aria-label={isInteractive ? titleAttr : undefined}
        className={cn(
          "absolute left-0.5 right-0.5 z-[20] overflow-hidden rounded-md border border-border bg-card text-left shadow-sm outline-none",
          "flex min-h-0 flex-col justify-start gap-0.5 border-l-[4px]",
          b.likelyExam && "relative",
          b.likelyExam &&
            "border-dashed border-muted-foreground/50 bg-[repeating-linear-gradient(-52deg,transparent,transparent_5px,rgba(0,0,0,0.04)_5px,rgba(0,0,0,0.04)_6px)]",
          isInteractive &&
            "touch-none select-none cursor-pointer active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          !enableMagicMove && dimmed && "opacity-35",
          extraClass,
        )}
        style={{
          top: topPx,
          height: heightPx,
          borderLeftColor: b.color,
          paddingTop: pad,
          paddingBottom: pad + examFooterPad,
          paddingLeft: Math.min(10, pad + 4),
          paddingRight: Math.min(8, pad + 2),
          ["--calendar-block-corner-inset" as string]: `${cornerInset}px`,
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
        {b.likelyExam ? (
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] truncate border-t border-primary/30 bg-card/95 px-1 py-px text-center font-mono font-medium leading-tight text-primary"
            style={{ fontSize: Math.max(7, secondaryPx) }}
            title={examNote}
          >
            {examShort}
          </span>
        ) : null}
      </BlockTag>
    );
  });

  return (
    <div
      role="presentation"
      className={cn(
        "relative min-w-[4.5rem] flex-1 border-l border-border",
        isMuted && "opacity-40",
        dayColumnClassName,
      )}
      style={{ height: gridHeightPx, minHeight: gridHeightPx }}
      {...(dayColumnHandlers ?? {})}
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
      {backToBackChips.map((chip) => {
                    const topPx = ((chip.atMinute - startMin) / totalMin) * gridHeightPx;
                    return (
                      <div
                        key={chip.key}
                        className="pointer-events-none absolute left-1 right-1 z-25 -translate-y-1/2"
                        style={{ top: topPx }}
                        aria-hidden
                      >
                        <span
                          className="block truncate rounded border border-amber-500/50 bg-amber-50/90 px-1 py-px text-[9px] leading-tight text-amber-900 shadow-sm"
                          title={chip.title}
                        >
                          {chip.label}
                        </span>
                      </div>
                    );
      })}
      {enableMagicMove ? (
        <AnimatePresence mode="popLayout">{blockNodes}</AnimatePresence>
      ) : (
        blockNodes
      )}
    </div>
  );
});
