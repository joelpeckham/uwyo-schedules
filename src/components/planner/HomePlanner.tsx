"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ensurePlannerSessionAction } from "@/app/planner/actions";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import type { PlannerTermUiStateRow } from "@/lib/planner/catalog-bootstrap";
import type { CalendarBlock } from "@/lib/planner/data";
import type { PlannerItemRow } from "@/lib/planner/data";
import { parseBlackoutsJson } from "@/lib/planner/blackouts";
import { parseKeptSolutionsJson } from "@/lib/planner/kept-solutions";
import { parseTimePrefs } from "@/lib/planner/time-prefs";

import { CourseManager } from "./CourseManager";
import { NotOnGridRail } from "./NotOnGridRail";
import { PlannerProvider } from "./PlannerContext";
import { PlannerEmptyHero } from "./PlannerEmptyHero";
import { ShareLinkApplier } from "./ShareLinkApplier";
import { TimePrefsCard } from "./TimePrefsCard";
import { WeekCalendarLoadingPlaceholder } from "./WeekCalendarLoadingPlaceholder";

// Loaded only when the user opens a section block; the modal owns a
// non-trivial JSON tree view that we keep out of the initial bundle.
const SectionJsonModal = dynamic(
  () => import("./SectionJsonModal").then((m) => m.SectionJsonModal),
  { ssr: false },
);

const WeekCalendar = dynamic(
  () => import("./WeekCalendar").then((m) => m.WeekCalendar),
  {
    loading: () => <WeekCalendarLoadingPlaceholder />,
  },
);

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
            Add courses, set optional instructor preferences, and the planner
            keeps a conflict-free week ready. Pin sections you like, drag a
            block to try other times, or tap for details.
          </p>
        </div>

        {!hasData ? (
          <NoDataNotice />
        ) : (
          <>
            <ShareLinkApplier termCode={termCode} plannerItems={plannerItems} />
            <PlannerProvider
              key={termCode}
              termCode={termCode}
              initialPlannerItems={plannerItems}
              initialCatalog={catalog}
              initialTermUiState={
                termUiState
                  ? {
                      blackouts: parseBlackoutsJson(termUiState.blackouts),
                      keptSolutions: parseKeptSolutionsJson(
                        termUiState.keptSolutionKeys,
                      ),
                      timePrefs: parseTimePrefs(termUiState.timePrefs),
                      lastSolutionIndex: termUiState.lastSolutionIndex,
                    }
                  : null
              }
            >
              <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
                <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:z-1 lg:max-h-[min(100vh-2rem,56rem)] lg:self-start lg:overflow-y-auto">
                  <CourseManager key={termCode} termCode={termCode} />
                  <TimePrefsCard />
                </div>
                <div className="mt-6 flex min-w-0 flex-col gap-4 lg:mt-0">
                  <PlannerEmptyHero termCode={termCode} />
                  <WeekCalendar onBlockActivate={onBlockActivate} />
                  <NotOnGridRail onCrnActivate={onCrnActivate} />
                </div>
              </div>
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
