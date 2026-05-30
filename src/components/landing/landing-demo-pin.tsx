"use client";

import { CalendarBlockPinBadge } from "@/components/planner/week-calendar/CalendarBlockPinBadge";
import { LANDING_DEMO_PINNED_KEYS } from "@/lib/planner/landing-preview-demo";
import type { CalendarBlock } from "@/lib/planner/data";

export function isLandingDemoPinnedBlock(block: CalendarBlock): boolean {
  return (LANDING_DEMO_PINNED_KEYS as readonly string[]).includes(block.key);
}

export function LandingDemoPinBadge() {
  return <CalendarBlockPinBadge />;
}
