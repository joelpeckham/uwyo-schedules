"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ensurePlannerSessionAction } from "@/app/planner/actions";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import type { PlannerTermUiStateRow } from "@/lib/planner/catalog-bootstrap";
import type { CalendarBlock } from "@/lib/planner/data";
import type { PlannerItemRow } from "@/lib/planner/data";
import type { TermOption } from "@/lib/planner/data";
import { parseBlackoutsJson } from "@/lib/planner/blackouts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CourseManager } from "./CourseManager";
import { PlannerProvider } from "./PlannerContext";
import { SchedulePager } from "./SchedulePager";
import { SectionJsonModal } from "./SectionJsonModal";
import { WeekCalendar } from "./WeekCalendar";

type Props = {
  terms: TermOption[];
  termCode: string;
  plannerItems: PlannerItemRow[];
  catalog: PlannerCatalogJson;
  termUiState: PlannerTermUiStateRow | null;
  hasSessionCookie: boolean;
};

export function HomePlanner({
  terms,
  termCode,
  plannerItems,
  catalog,
  termUiState,
  hasSessionCookie,
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

  const onTermChange = (next: string) => {
    router.replace(`/?term=${encodeURIComponent(next)}`);
  };

  const onBlockActivate = (block: CalendarBlock) => {
    setModalCrn(block.sectionCrn);
    setModalOpen(true);
  };

  const hasData = terms.length > 0 && termCode.length > 0;

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:max-w-[90rem]">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex shrink-0">
              <Image
                src="/brand/logo-wordmark.svg"
                alt="uwyoschedule home"
                width={180}
                height={36}
                priority
                sizes="(max-width: 640px) 160px, 180px"
                className="text-primary"
              />
            </Link>
          </div>
          {hasData ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <label
                htmlFor="planner-term-select"
                className="text-xs font-medium text-muted-foreground sm:shrink-0"
              >
                Term
              </label>
              <Select value={termCode} onValueChange={onTermChange}>
                <SelectTrigger
                  id="planner-term-select"
                  size="default"
                  className="min-h-11 w-full min-w-[12rem] touch-manipulation sm:w-56"
                >
                  <SelectValue placeholder="Choose term" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {`${t.description} (${t.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:max-w-[90rem]">
        <div
          id="planner"
          tabIndex={-1}
          className="scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Planner
          </p>
          <h2 className="mt-1 font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Your week
          </h2>
          <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Add courses, set optional instructor preferences, and page through
            valid weekly schedules. Tap a block for Banner section details.
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
                    lastSolutionIndex: termUiState.lastSolutionIndex,
                    favoriteSolutionIndex: termUiState.favoriteSolutionIndex,
                    blackouts: parseBlackoutsJson(termUiState.blackouts),
                  }
                : null
            }
          >
            <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
              <div className="min-w-0">
                <CourseManager key={termCode} termCode={termCode} />
              </div>
              <div className="mt-6 flex min-w-0 flex-col gap-4 lg:mt-0">
                <SchedulePager />
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
      </main>
    </div>
  );
}
