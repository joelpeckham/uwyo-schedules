"use client";

import { cn } from "@/lib/utils";

type Props = {
  show: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Collapses children with a height transition instead of unmounting (reduces CLS).
 */
export function PlannerCollapsibleSlot({ show, children, className }: Props) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        className,
      )}
      style={{ gridTemplateRows: show ? "1fr" : "0fr" }}
      aria-hidden={!show}
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
