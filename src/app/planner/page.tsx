import type { Metadata } from "next";
import { Suspense } from "react";
import { HomePlanner } from "@/components/planner/HomePlanner";
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

export const metadata: Metadata = {
  title: "Schedule planner",
  description:
    "Pick UW courses, set optional preferences and busy times, and watch a best conflict-free week stay in sync—pin sections or drag for same-type alternatives on the calendar.",
  alternates: { canonical: "/planner" },
  openGraph: {
    url: absoluteUrl("/planner"),
    title: "Schedule planner · uwyoschedule",
    description:
      "Pick UW courses and preferences; the planner keeps a best conflict-free week in sync as you pin sections or try same-type alternatives.",
  },
};

const emptyCatalog: PlannerCatalogJson = {
  sections: [],
  meetings: [],
  linkedBundles: [],
  linkedBundleMembers: [],
  facultyByCrn: {},
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
    <Suspense fallback={null}>
      <PlannerBody searchParams={searchParams} />
    </Suspense>
  );
}
