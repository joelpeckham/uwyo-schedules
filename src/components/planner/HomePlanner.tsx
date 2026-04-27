"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ensurePlannerSessionAction } from "@/app/planner/actions";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import type { PlannerTermUiStateRow } from "@/lib/planner/catalog-bootstrap";
import type { CalendarBlock } from "@/lib/planner/data";
import type { PlannerItemRow } from "@/lib/planner/data";
import { parseBlackoutsJson } from "@/lib/planner/blackouts";

import { CourseManager } from "./CourseManager";
import { PlannerProvider } from "./PlannerContext";
import { SectionJsonModal } from "./SectionJsonModal";
import { WeekCalendar } from "./WeekCalendar";

type Props = {
  termCode: string;
  plannerItems: PlannerItemRow[];
  catalog: PlannerCatalogJson;
  termUiState: PlannerTermUiStateRow | null;
  hasSessionCookie: boolean;
  /** When false, the page shows the empty-state message (no ingest yet). */
  hasData: boolean;
};

export function HomePlanner({
  termCode,
  plannerItems,
  catalog,
  termUiState,
  hasSessionCookie,
  hasData,
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCrn, setModalCrn] = useState<string | null>(null);

  useEffect(() => {
    if (hasSessionCookie) return;
    void ensurePlannerSessionAction().then(() => {
      router.refresh();
    });
  }, [hasSessionCookie, router]);

  const onBlockActivate = (block: CalendarBlock) => {
    setModalCrn(block.sectionCrn);
    setModalOpen(true);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:max-w-[90rem]">
        <div
          id="planner"
          tabIndex={-1}
          className="scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Planner
          </p>
          <h1 className="mt-1 font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Your week
          </h1>
          <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Add courses, set optional instructor preferences, and watch the best
            conflict-free week update as you go. Pin sections you like, drag a
            block to try same-type alternatives, or tap for details.
          </p>
        </div>

        {!hasData ? (
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            No term data in the database yet. Run an ingest job, then reload
            this page.
          </p>
        ) : (
          <PlannerProvider
            key={termCode}
            termCode={termCode}
            initialPlannerItems={plannerItems}
            initialCatalog={catalog}
            initialTermUiState={
              termUiState
                ? {
                    blackouts: parseBlackoutsJson(termUiState.blackouts),
                  }
                : null
            }
          >
            <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
              <div className="min-w-0 lg:sticky lg:top-4 lg:z-1 lg:max-h-[min(100vh-2rem,56rem)] lg:self-start lg:overflow-y-auto">
                <CourseManager key={termCode} termCode={termCode} />
              </div>
              <div className="mt-6 flex min-w-0 flex-col gap-4 lg:mt-0">
                <WeekCalendar onBlockActivate={onBlockActivate} />
              </div>
            </div>
            <SectionJsonModal
              open={modalOpen}
              onOpenChange={setModalOpen}
              termCode={termCode}
              crn={modalCrn}
            />
          </PlannerProvider>
        )}
      </div>
    </div>
  );
}
