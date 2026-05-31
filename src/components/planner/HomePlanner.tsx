"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { CalendarBlock } from "@/lib/planner/data";
import { usePlannerViewSettings } from "@/lib/planner/planner-view-settings";

import { CourseManager } from "./CourseManager";
import { NotOnGridRail, useNotOnGridRailRows } from "./NotOnGridRail";
import { PlannerBootstrap } from "./PlannerBootstrap";
import { PlannerProvider } from "./PlannerContext";
import { PlannerEmptyHeroSlot } from "./PlannerEmptyHeroSlot";
import { PlannerCollapsibleSlot } from "./PlannerCollapsibleSlot";
import { ShareLinkApplier } from "./ShareLinkApplier";
import { FiltersCard } from "./FiltersCard";
import { PlannerHydrationGate } from "./PlannerHydrationGate";
import { PlannerIntroHeader } from "./PlannerIntroHeader";
import { WeekCalendar } from "./WeekCalendar";

const SectionJsonModal = dynamic(
  () => import("./SectionJsonModal").then((m) => m.SectionJsonModal),
  { ssr: false },
);

type Props = {
  termCode: string;
  /** When false, the page shows the empty-state message (no ingest yet). */
  hasData: boolean;
};

export function HomePlanner({ termCode, hasData }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCrn, setModalCrn] = useState<string | null>(null);
  const { showCourseSelector, showFilters } = usePlannerViewSettings();
  const showLeftColumn = showCourseSelector || showFilters;

  const onBlockActivate = useCallback((block: CalendarBlock) => {
    setModalCrn(block.sectionCrn);
    setModalOpen(true);
  }, []);

  const onCrnActivate = useCallback((crn: string) => {
    setModalCrn(crn);
    setModalOpen(true);
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:max-w-[84rem]">
        <PlannerIntroHeader />

        {!hasData ? (
          <NoDataNotice />
        ) : (
          <>
            <PlannerBootstrap termCode={termCode} />
            <PlannerProvider key={termCode} termCode={termCode}>
              <Suspense fallback={null}>
                <ShareLinkApplier termCode={termCode} />
              </Suspense>
              <PlannerHydrationGate>
                <div
                  className={
                    showLeftColumn
                      ? "lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6"
                      : undefined
                  }
                >
                  {showLeftColumn ? (
                    <div className="min-w-0 space-y-4">
                      {showCourseSelector ? (
                        <CourseManager key={termCode} termCode={termCode} />
                      ) : null}
                      {showFilters ? <FiltersCard /> : null}
                    </div>
                  ) : null}
                  <PlannerCalendarColumn
                    termCode={termCode}
                    onBlockActivate={onBlockActivate}
                    onCrnActivate={onCrnActivate}
                  />
                </div>
              </PlannerHydrationGate>
            </PlannerProvider>
            {modalOpen ? (
              <SectionJsonModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                termCode={termCode}
                crn={modalCrn}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function PlannerCalendarColumn({
  termCode,
  onBlockActivate,
  onCrnActivate,
}: {
  termCode: string;
  onBlockActivate: (block: CalendarBlock) => void;
  onCrnActivate: (crn: string) => void;
}) {
  const offGridRows = useNotOnGridRailRows();

  const showOffGridRail = offGridRows.length > 0;

  return (
    <div className="mt-6 flex min-w-0 flex-col lg:mt-0">
      <PlannerEmptyHeroSlot termCode={termCode} />
      <WeekCalendar onBlockActivate={onBlockActivate} />
      <PlannerCollapsibleSlot show={showOffGridRail} className={showOffGridRail ? "mt-4" : undefined}>
        <NotOnGridRail onCrnActivate={onCrnActivate} />
      </PlannerCollapsibleSlot>
    </div>
  );
}

function NoDataNotice() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          router.refresh();
          return 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [router]);

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-6 text-sm text-card-foreground shadow-sm">
      <p className="font-heading text-base font-medium text-foreground">
        We&rsquo;re still ingesting this term.
      </p>
      <p className="mt-1 leading-relaxed text-muted-foreground">
        Banner schedule data lands in batches; the planner will turn on as
        soon as the catalog finishes loading. Try a different term from the
        dropdown above, or wait here&mdash;the page reloads automatically.
      </p>
      <p
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        Auto-refresh in {secondsLeft}s
        <button
          type="button"
          className="text-foreground underline-offset-2 hover:underline"
          onClick={() => router.refresh()}
        >
          refresh now
        </button>
      </p>
    </div>
  );
}
