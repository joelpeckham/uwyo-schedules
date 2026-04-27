import type { Metadata } from "next";
import { HomePlanner } from "@/components/planner/HomePlanner";
import { PlannerTermSelect } from "@/components/planner/PlannerTermSelect";
import { PlannerJsonLd } from "@/components/seo/PlannerJsonLd";
import { SiteChrome } from "@/components/seo/SiteChrome";
import { createDb } from "@/db/index";
import { loadPlannerCatalogBootstrap } from "@/lib/planner/catalog-bootstrap";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import { getLatestTermCode, listTerms } from "@/lib/planner/data";
import { readPlannerSessionIdFromCookies } from "@/lib/planner/session";
import { absoluteUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Schedule planner",
  description:
    "Pick UW courses, set preferences, page through every conflict-free weekly schedule from the UW course catalog.",
  alternates: { canonical: "/planner" },
  openGraph: {
    url: absoluteUrl("/planner"),
    title: "Schedule planner · uwyoschedule",
    description:
      "Pick UW courses, set preferences, page through every conflict-free weekly schedule.",
  },
};

const emptyCatalog: PlannerCatalogJson = {
  sections: [],
  meetings: [],
  linkedBundles: [],
  linkedBundleMembers: [],
  facultyByCrn: {},
};

export default async function PlannerPage({
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
