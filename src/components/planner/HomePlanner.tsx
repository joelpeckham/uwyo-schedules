"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  ensurePlannerSessionAction,
  loadPlannerCalendarStateAction,
} from "@/app/planner/actions";
import type { CalendarBlock, SwapGhostMeeting } from "@/lib/planner/data";
import type { PlannerItemRow } from "@/lib/planner/data";
import type { TermOption } from "@/lib/planner/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CourseManager } from "./CourseManager";
import { SectionJsonModal } from "./SectionJsonModal";
import { WeekCalendar } from "./WeekCalendar";

type Props = {
  terms: TermOption[];
  termCode: string;
  plannerItems: PlannerItemRow[];
  calendarBlocks: CalendarBlock[];
  swapGhostsPrefetch: Record<string, SwapGhostMeeting[]>;
  hasSessionCookie: boolean;
};

export function HomePlanner({
  terms,
  termCode,
  plannerItems,
  calendarBlocks,
  swapGhostsPrefetch,
  hasSessionCookie,
}: Props) {
  const router = useRouter();
  const [, startPropSync] = useTransition();
  const [livePlannerItems, setLivePlannerItems] = useState(plannerItems);
  const [liveCalendarBlocks, setLiveCalendarBlocks] = useState(calendarBlocks);
  const [liveSwapPrefetch, setLiveSwapPrefetch] = useState(swapGhostsPrefetch);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCrn, setModalCrn] = useState<string | null>(null);

  useEffect(() => {
    startPropSync(() => {
      setLivePlannerItems(plannerItems);
      setLiveCalendarBlocks(calendarBlocks);
      setLiveSwapPrefetch(swapGhostsPrefetch);
    });
  }, [plannerItems, calendarBlocks, swapGhostsPrefetch, startPropSync]);

  const refreshPlannerVisuals = useCallback(async (): Promise<boolean> => {
    const res = await loadPlannerCalendarStateAction(termCode);
    if (!res.ok) return false;
    setLivePlannerItems(res.plannerItems);
    setLiveCalendarBlocks(res.calendarBlocks);
    setLiveSwapPrefetch(res.swapGhostsPrefetch);
    return true;
  }, [termCode]);

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
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/brand/logo-wordmark.svg"
              alt="uwyoSchedules"
              width={180}
              height={36}
              priority
              className="text-primary"
            />
          </div>
          {hasData ? (
            <div className="flex flex-col gap-2 sm:items-end">
              <label className="text-xs font-medium text-muted-foreground">
                Term
              </label>
              <Select value={termCode} onValueChange={onTermChange}>
                <SelectTrigger
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

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Your week
          </h1>
          <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Add courses, pick sections or linked combinations, and tap a block
            to see structured section details from Banner.
          </p>
        </div>

        {!hasData ? (
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            No term data in the database yet. Run an ingest job, then reload
            this page.
          </p>
        ) : (
          <>
            <CourseManager
              key={termCode}
              termCode={termCode}
              plannerItems={livePlannerItems}
            />
            <WeekCalendar
              termCode={termCode}
              blocks={liveCalendarBlocks}
              swapGhostsPrefetch={liveSwapPrefetch}
              onPlannerCalendarUpdated={refreshPlannerVisuals}
              onBlockActivate={onBlockActivate}
            />
          </>
        )}
      </main>

      <SectionJsonModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        termCode={termCode}
        crn={modalCrn}
      />
    </div>
  );
}
