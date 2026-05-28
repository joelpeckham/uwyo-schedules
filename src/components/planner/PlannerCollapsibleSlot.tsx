"use client";

import { cn } from "@/lib/utils";

type Props = {
  show: boolean;
  children: React.ReactNode;
  className?: string;
  /**
   * When true, expand/collapse is driven by html[data-planner-items] (pre-paint
   * bootstrap) instead of inline grid rows. Use only for the empty-hero slot.
   */
  prePaintBootstrap?: boolean;
};

/**
 * Collapses children with a height transition instead of unmounting (reduces CLS).
 */
export function PlannerCollapsibleSlot({
  show,
  children,
  className,
  prePaintBootstrap = false,
}: Props) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        className,
      )}
      {...(prePaintBootstrap ? { "data-planner-empty-hero": true } : {})}
      style={
        prePaintBootstrap
          ? undefined
          : { gridTemplateRows: show ? "1fr" : "0fr" }
      }
      aria-hidden={!show}
      {...(prePaintBootstrap ? { suppressHydrationWarning: true } : {})}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden transition-opacity duration-200",
          !show && "pointer-events-none opacity-0",
        )}
        {...(!show ? { inert: true as const } : {})}
      >
        {children}
      </div>
    </div>
  );
}
