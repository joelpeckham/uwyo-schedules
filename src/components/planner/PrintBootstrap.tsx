"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  loadPlannerCatalogForItemsAction,
  solveSchedulesAction,
} from "@/app/planner/actions";
import { PrintScheduleView } from "@/components/planner/PrintScheduleView";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import type { PlannerItemRow } from "@/lib/planner/data";
import { readTerm } from "@/lib/planner/local-state";
import {
  applyResolvedSelectionsToPlannerItems,
  decodePrintSelections,
} from "@/lib/planner/print-state";
import { DEFAULT_PLANNER_SCHEDULE_FILTERS } from "@/lib/planner/schedule-filters";

const EMPTY_CATALOG: PlannerCatalogJson = {
  sections: [],
  meetings: [],
  linkedBundles: [],
  linkedBundleMembers: [],
  facultyByCrn: {},
  examReservationsByCrn: {},
  vagueExamNoteByCrn: {},
};

type Props = {
  termCode: string;
  termDescription: string | null;
};

function clampSolutionIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  if (index < 0) return 0;
  if (index >= total) return total - 1;
  return Math.floor(index);
}

export function PrintBootstrap({ termCode, termDescription }: Props) {
  const searchParams = useSearchParams();
  const printParam = searchParams.get("p");
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  );
  const [plannerItems, setPlannerItems] = useState<PlannerItemRow[]>([]);
  const [catalog, setCatalog] = useState<PlannerCatalogJson>(EMPTY_CATALOG);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const term = readTerm(termCode);
      if (term.items.length === 0) {
        if (!cancelled) setStatus("empty");
        return;
      }

      let displayItems = term.items;
      const fromUrl = printParam ? decodePrintSelections(printParam) : null;

      if (fromUrl) {
        displayItems = applyResolvedSelectionsToPlannerItems(
          term.items,
          fromUrl,
        );
      } else {
        const res = await solveSchedulesAction(
          termCode,
          term.items,
          DEFAULT_PLANNER_SCHEDULE_FILTERS,
          term.blackouts,
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          setStatus("error");
          return;
        }
        const idx = clampSolutionIndex(
          term.lastSolutionIndex,
          res.result.solutions.length,
        );
        const sol = res.result.solutions[idx];
        if (sol) {
          displayItems = applyResolvedSelectionsToPlannerItems(
            term.items,
            sol.selections,
          );
        }
      }

      const catRes = await loadPlannerCatalogForItemsAction(
        termCode,
        displayItems,
      );
      if (cancelled) return;
      if (!catRes.ok) {
        setError(catRes.error);
        setStatus("error");
        return;
      }
      setPlannerItems(displayItems);
      setCatalog(catRes.catalog);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [termCode, printParam]);

  if (status === "loading") {
    return (
      <p className="p-6 text-sm text-muted-foreground" role="status">
        Preparing schedule&hellip;
      </p>
    );
  }
  if (status === "empty") {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No courses to print. Add courses in the planner first.
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="p-6 text-sm text-destructive" role="alert">
        {error ?? "Could not load schedule."}
      </p>
    );
  }

  return (
    <PrintScheduleView
      termCode={termCode}
      termDescription={termDescription}
      plannerItems={plannerItems}
      catalog={catalog}
    />
  );
}
