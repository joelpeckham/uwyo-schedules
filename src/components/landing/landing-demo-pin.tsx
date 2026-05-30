"use client";

import { Pin } from "lucide-react";

import { LANDING_DEMO_PINNED_KEYS } from "@/lib/planner/landing-preview-demo";
import type { CalendarBlock } from "@/lib/planner/data";

export function isLandingDemoPinnedBlock(block: CalendarBlock): boolean {
  return (LANDING_DEMO_PINNED_KEYS as readonly string[]).includes(block.key);
}

export function LandingDemoPinBadge() {
  return (
    <span
      className="pointer-events-none absolute right-0.5 top-0.5 z-[2] rounded-sm bg-card/90 p-0.5 text-muted-foreground shadow-sm"
      aria-hidden
    >
      <Pin className="size-2.5 fill-current" strokeWidth={2} />
    </span>
  );
}
