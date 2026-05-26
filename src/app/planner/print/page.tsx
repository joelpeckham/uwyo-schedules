import type { Metadata } from "next";
import { Suspense } from "react";
import { createDb } from "@/db/index";
import { loadPlannerCatalogBootstrap } from "@/lib/planner/catalog-bootstrap";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import type { PlannerItemRow } from "@/lib/planner/data";
import {
  applyResolvedSelectionsToPlannerItems,
  decodePrintSelections,
} from "@/lib/planner/print-state";
import {
  DEFAULT_PLANNER_SCHEDULE_FILTERS,
} from "@/lib/planner/schedule-filters";
import { solveSchedulesForTerm } from "@/lib/planner/solve-schedules";
import {
  getLatestTermCodeForSeo,
  listTermsForSeo,
} from "@/lib/seo/queries";
import { readPlannerSessionIdFromCookies } from "@/lib/planner/session";
import { PrintScheduleView } from "@/components/planner/PrintScheduleView";

export const metadata: Metadata = {
  title: "Print schedule",
  description: "Printable view of your weekly UW schedule.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/planner/print" },
};

const EMPTY_CATALOG: PlannerCatalogJson = {
  sections: [],
  meetings: [],
  linkedBundles: [],
  linkedBundleMembers: [],
  facultyByCrn: {},
  examReservationsByCrn: {},
  vagueExamNoteByCrn: {},
};

function clampSolutionIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  if (index < 0) return 0;
  if (index >= total) return total - 1;
  return Math.floor(index);
}

async function resolvePrintPlannerItems(
  db: ReturnType<typeof createDb>,
  termCode: string,
  plannerItems: PlannerItemRow[],
  printParam: string | undefined,
  lastSolutionIndex: number,
): Promise<PlannerItemRow[]> {
  if (plannerItems.length === 0) return plannerItems;

  const fromUrl = printParam ? decodePrintSelections(printParam) : null;
  if (fromUrl) {
    return applyResolvedSelectionsToPlannerItems(plannerItems, fromUrl);
  }

  const result = await solveSchedulesForTerm(db, termCode, plannerItems, {
    ...DEFAULT_PLANNER_SCHEDULE_FILTERS,
    maxSolutions: 25,
  });
  const idx = clampSolutionIndex(lastSolutionIndex, result.solutions.length);
  const sol = result.solutions[idx];
  if (!sol) return plannerItems;
  return applyResolvedSelectionsToPlannerItems(plannerItems, sol.selections);
}

async function PrintBody({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; p?: string }>;
}) {
  const [terms, latest, sp] = await Promise.all([
    listTermsForSeo(),
    getLatestTermCodeForSeo(),
    searchParams,
  ]);
  const termFromQuery =
    sp.term && terms.some((t) => t.code === sp.term) ? sp.term : null;
  const termCode =
    termFromQuery ?? latest ?? (terms.length > 0 ? terms[0]!.code : "");
  const termRow = terms.find((t) => t.code === termCode) ?? null;

  const sessionId = await readPlannerSessionIdFromCookies();
  const db = createDb();
  const bootstrap =
    sessionId && termCode
      ? await loadPlannerCatalogBootstrap(db, sessionId, termCode)
      : {
          plannerItems: [] as PlannerItemRow[],
          catalog: { ...EMPTY_CATALOG },
          termUiState: null,
        };

  const displayItems =
    sessionId && termCode && bootstrap.plannerItems.length > 0
      ? await resolvePrintPlannerItems(
          db,
          termCode,
          bootstrap.plannerItems,
          sp.p,
          bootstrap.termUiState?.lastSolutionIndex ?? 0,
        )
      : bootstrap.plannerItems;

  return (
    <PrintScheduleView
      termCode={termCode}
      termDescription={termRow?.description ?? null}
      plannerItems={displayItems}
      catalog={bootstrap.catalog}
    />
  );
}

export default function PlannerPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; p?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-muted-foreground">
          Preparing schedule&hellip;
        </p>
      }
    >
      <PrintBody searchParams={searchParams} />
    </Suspense>
  );
}
