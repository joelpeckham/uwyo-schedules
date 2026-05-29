import { SiteChrome } from "@/components/seo/SiteChrome";

import { PlannerPageFallback } from "./PlannerPageFallback";

const headerTermSelectStub = (
  <div
    aria-hidden
    className="h-9 min-w-48 rounded-md border border-border bg-muted/30 sm:w-56"
  />
);

/**
 * Route-level Suspense fallback and loading.tsx shell — mirrors the planner
 * page with SiteChrome so soft navigations do not shift the header.
 */
export function PlannerSkeleton() {
  return (
    <SiteChrome actions={headerTermSelectStub}>
      <PlannerPageFallback />
    </SiteChrome>
  );
}
