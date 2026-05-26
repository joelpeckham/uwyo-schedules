import type { Metadata } from "next";
import { Suspense } from "react";
import { HomePlanner } from "@/components/planner/HomePlanner";
import { PlannerSkeleton } from "@/components/planner/PlannerSkeleton";
import { PlannerTermSelect } from "@/components/planner/PlannerTermSelect";
import { PlannerJsonLd } from "@/components/seo/PlannerJsonLd";
import { SiteChrome } from "@/components/seo/SiteChrome";
import { createDb } from "@/db/index";
import { loadPlannerCatalogBootstrap } from "@/lib/planner/catalog-bootstrap";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import {
  getLatestTermCodeForSeo,
  listTermsForSeo,
} from "@/lib/seo/queries";
import { readPlannerSessionIdFromCookies } from "@/lib/planner/session";
import { absoluteUrl } from "@/lib/seo/site";

const PLANNER_DESCRIPTION =
  "UW class schedule planner: add courses, block busy times, set instructor preferences, and keep a conflict-free week in sync. Pin sections, try same-type swaps, page through alternate weeks, compare kept schedules, and share a link.";

export const metadata: Metadata = {
  title: "UW class schedule planner",
  description: PLANNER_DESCRIPTION,
  alternates: { canonical: "/planner" },
  openGraph: {
    url: absoluteUrl("/planner"),
    title: "UW class schedule planner · uwyoschedule",
    description: PLANNER_DESCRIPTION,
  },
};

const emptyCatalog: PlannerCatalogJson = {
  sections: [],
  meetings: [],
  linkedBundles: [],
  linkedBundleMembers: [],
  facultyByCrn: {},
  examReservationsByCrn: {},
  vagueExamNoteByCrn: {},
};

async function PlannerBody({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
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

  const sessionId = await readPlannerSessionIdFromCookies();
  const db = createDb();
  const { plannerItems, catalog, termUiState } =
    sessionId && termCode
      ? await loadPlannerCatalogBootstrap(db, sessionId, termCode)
      : { plannerItems: [], catalog: emptyCatalog, termUiState: null };

  const hasData = terms.length > 0 && termCode.length > 0;

  return (
    <SiteChrome
      actions={
        hasData ? <PlannerTermSelect terms={terms} termCode={termCode} /> : null
      }
    >
      <PlannerJsonLd />
      <HomePlanner
        termCode={termCode}
        plannerItems={plannerItems}
        catalog={catalog}
        termUiState={termUiState}
        hasSessionCookie={!!sessionId}
        hasData={hasData}
      />
    </SiteChrome>
  );
}

export default function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  return (
    <Suspense fallback={<PlannerSkeleton />}>
      <PlannerBody searchParams={searchParams} />
    </Suspense>
  );
}
