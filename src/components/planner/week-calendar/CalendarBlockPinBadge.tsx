"use client";

import { Pin } from "lucide-react";
import type { ComponentProps, CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** Fallback when pin is not inside a calendar block (should not happen in prod). */
const CORNER_INSET_FALLBACK = "4px";

const PIN_CORNER_STYLE: CSSProperties = {
  top: `var(--calendar-block-corner-inset, ${CORNER_INSET_FALLBACK})`,
  right: `var(--calendar-block-corner-inset, ${CORNER_INSET_FALLBACK})`,
};

const PIN_BADGE_CLASS =
  "inline-flex size-4 shrink-0 items-center justify-center p-0 leading-none rounded-sm bg-card/90 text-muted-foreground shadow-sm";

function CalendarBlockPinIcon({ pinned }: { pinned: boolean }) {
  return (
    <Pin
      className={cn("size-2.5 shrink-0", pinned && "fill-current")}
      strokeWidth={2}
      aria-hidden
    />
  );
}

/** Decorative pin on calendar blocks (landing preview, demos). */
export function CalendarBlockPinBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute z-2",
        PIN_BADGE_CLASS,
        className,
      )}
      style={PIN_CORNER_STYLE}
      aria-hidden
    >
      <CalendarBlockPinIcon pinned />
    </span>
  );
}

/** Interactive pin in the block corner — same position as {@link CalendarBlockPinBadge}. */
export function CalendarBlockPinControl({
  pinned,
  className,
  onPointerDown,
  ...props
}: { pinned: boolean } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "pointer-events-auto absolute z-2 touch-manipulation",
        PIN_BADGE_CLASS,
        "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
      style={PIN_CORNER_STYLE}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown?.(e);
      }}
      {...props}
    >
      <CalendarBlockPinIcon pinned={pinned} />
    </button>
  );
}
