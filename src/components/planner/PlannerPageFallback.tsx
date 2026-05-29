import { PlannerGridPlaceholder } from "./PlannerGridPlaceholder";
import { PlannerIntroHeader } from "./PlannerIntroHeader";

/** Inner planner shell fallback (no SiteChrome — used inside page Suspense). */
export function PlannerPageFallback() {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:max-w-[90rem]">
        <PlannerIntroHeader />
        <PlannerGridPlaceholder />
      </div>
    </div>
  );
}
