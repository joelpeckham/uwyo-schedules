"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  loadPlannerCatalogExamEnrichmentAction,
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
        const sol = res.result.solutions[0];
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
      const enrichRes = await loadPlannerCatalogExamEnrichmentAction(
        termCode,
        displayItems,
      );
      if (cancelled) return;
      const catalog: PlannerCatalogJson =
        enrichRes.ok
          ? {
              ...catRes.catalog,
              examReservationsByCrn: enrichRes.examReservationsByCrn,
              vagueExamNoteByCrn: enrichRes.vagueExamNoteByCrn,
            }
          : catRes.catalog;
      setPlannerItems(displayItems);
      setCatalog(catalog);
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
