import type { Metadata } from "next";
import { Suspense } from "react";
import { HomePlanner } from "@/components/planner/HomePlanner";
import { PlannerSettingsMenu } from "@/components/planner/PlannerSettingsMenu";
import { PlannerTermSelect } from "@/components/planner/PlannerTermSelect";
import { PlannerJsonLd } from "@/components/seo/PlannerJsonLd";
import { SiteChrome } from "@/components/seo/SiteChrome";
import type { TermOption } from "@/lib/planner/data";
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

const headerTermSelectStub = (
  <div
    aria-hidden
    className="h-9 min-w-48 rounded-md border border-border bg-muted/30 sm:w-56"
  />
);

function resolveTermCode(
  sp: { term?: string },
  terms: TermOption[],
  latest: string | null,
): string {
  const termFromQuery =
    sp.term && terms.some((t) => t.code === sp.term) ? sp.term : null;
  return termFromQuery ?? latest ?? (terms.length > 0 ? terms[0]!.code : "");
}

async function PlannerTermActions({
  searchParams,
  terms,
  latest,
}: {
  searchParams: Promise<{ term?: string }>;
  terms: TermOption[];
  latest: string | null;
}) {
  const sp = await searchParams;
  const termCode = resolveTermCode(sp, terms, latest);
  const hasData = terms.length > 0 && termCode.length > 0;
  return hasData ? (
    <div className="flex flex-wrap items-center gap-2">
      <PlannerTermSelect terms={terms} termCode={termCode} />
      <PlannerSettingsMenu />
    </div>
  ) : null;
}

async function PlannerMain({
  searchParams,
  terms,
  latest,
}: {
  searchParams: Promise<{ term?: string }>;
  terms: TermOption[];
  latest: string | null;
}) {
  const sp = await searchParams;
  const termCode = resolveTermCode(sp, terms, latest);
  const hasData = terms.length > 0 && termCode.length > 0;
  return <HomePlanner termCode={termCode} hasData={hasData} />;
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const [terms, latest] = await Promise.all([
    listTermsForSeo(),
    getLatestTermCodeForSeo(),
  ]);

  return (
    <SiteChrome
      actions={
        <Suspense fallback={headerTermSelectStub}>
          <PlannerTermActions
            searchParams={searchParams}
            terms={terms}
            latest={latest}
          />
        </Suspense>
      }
    >
      <PlannerJsonLd />
      <Suspense fallback={null}>
        <PlannerMain searchParams={searchParams} terms={terms} latest={latest} />
      </Suspense>
    </SiteChrome>
  );
}
