import type { Metadata } from "next";
import { Suspense } from "react";
import { HomePlanner } from "@/components/planner/HomePlanner";
import { PlannerSkeleton } from "@/components/planner/PlannerSkeleton";
import { PlannerTermSelect } from "@/components/planner/PlannerTermSelect";
import { PlannerJsonLd } from "@/components/seo/PlannerJsonLd";
import { SiteChrome } from "@/components/seo/SiteChrome";
import {
  getLatestTermCodeForSeo,
  listTermsForSeo,
} from "@/lib/seo/queries";
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

  const hasData = terms.length > 0 && termCode.length > 0;

  return (
    <SiteChrome
      actions={
        hasData ? <PlannerTermSelect terms={terms} termCode={termCode} /> : null
      }
    >
      <PlannerJsonLd />
      <HomePlanner termCode={termCode} hasData={hasData} />
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
