import type { Metadata } from "next";
import { HomePlanner } from "@/components/planner/HomePlanner";
import { HomeFooter } from "@/components/seo/HomeFooter";
import { HomeJsonLd } from "@/components/seo/HomeJsonLd";
import { HomeLanding } from "@/components/seo/HomeLanding";
import { createDb } from "@/db/index";
import { loadPlannerCatalogBootstrap } from "@/lib/planner/catalog-bootstrap";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import { getLatestTermCode, listTerms } from "@/lib/planner/data";
import { readPlannerSessionIdFromCookies } from "@/lib/planner/session";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const emptyCatalog: PlannerCatalogJson = {
  sections: [],
  meetings: [],
  linkedBundles: [],
  linkedBundleMembers: [],
  facultyByCrn: {},
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const db = createDb();
  const terms = await listTerms(db);
  const sp = await searchParams;
  const latest = await getLatestTermCode(db);
  const termFromQuery =
    sp.term && terms.some((t) => t.code === sp.term) ? sp.term : null;
  const termCode =
    termFromQuery ?? latest ?? (terms.length > 0 ? terms[0]!.code : "");

  const sessionId = await readPlannerSessionIdFromCookies();
  const { plannerItems, catalog, termUiState } =
    sessionId && termCode
      ? await loadPlannerCatalogBootstrap(db, sessionId, termCode)
      : { plannerItems: [], catalog: emptyCatalog, termUiState: null };

  return (
    <>
      <HomeJsonLd />
      <HomeLanding latestTermCode={latest} />
      <HomePlanner
        terms={terms}
        termCode={termCode}
        plannerItems={plannerItems}
        catalog={catalog}
        termUiState={termUiState}
        hasSessionCookie={!!sessionId}
      />
      <HomeFooter latestTermCode={latest} />
    </>
  );
}
