import type { Metadata } from "next";
import { Suspense } from "react";
import { createDb } from "@/db/index";
import { loadPlannerCatalogBootstrap } from "@/lib/planner/catalog-bootstrap";
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

async function PrintBody({
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
  const termRow = terms.find((t) => t.code === termCode) ?? null;

  const sessionId = await readPlannerSessionIdFromCookies();
  const db = createDb();
  const { plannerItems, catalog } =
    sessionId && termCode
      ? await loadPlannerCatalogBootstrap(db, sessionId, termCode)
      : {
          plannerItems: [],
          catalog: {
            sections: [],
            meetings: [],
            linkedBundles: [],
            linkedBundleMembers: [],
            facultyByCrn: {},
            examReservationsByCrn: {},
            vagueExamNoteByCrn: {},
          },
        };

  return (
    <PrintScheduleView
      termCode={termCode}
      termDescription={termRow?.description ?? null}
      plannerItems={plannerItems}
      catalog={catalog}
    />
  );
}

export default function PlannerPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
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
