import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CatalogBrowseSection } from "@/components/landing/CatalogBrowseSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LaramieCallout } from "@/components/landing/LaramieCallout";
import { PlannerCtaBand } from "@/components/landing/PlannerCtaBand";
import { PlannerPreview } from "@/components/landing/PlannerPreview";
import { TopSubjects } from "@/components/landing/TopSubjects";
import { HomeOrgFaqJsonLd } from "@/components/seo/HomeOrgFaqJsonLd";
import { HomeWebSiteJsonLd } from "@/components/seo/HomeWebSiteJsonLd";
import { LandingFooter } from "@/components/seo/LandingFooter";
import { SiteChrome } from "@/components/seo/SiteChrome";
import { getLatestTermRowForSeo } from "@/lib/seo/queries";
import {
  LANDING_DESCRIPTION,
  LANDING_DESCRIPTION_SHORT,
  LANDING_TITLE,
  absoluteUrl,
} from "@/lib/seo/site";

export const metadata: Metadata = {
  title: LANDING_TITLE,
  description: LANDING_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    url: absoluteUrl("/"),
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION_SHORT,
  },
};

async function RedirectIfTerm({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const sp = await searchParams;
  if (sp.term != null && sp.term !== "") {
    redirect(`/planner?term=${encodeURIComponent(sp.term)}`);
  }
  return null;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const latestTerm = await getLatestTermRowForSeo();

  return (
    <>
      <Suspense fallback={null}>
        <RedirectIfTerm searchParams={searchParams} />
      </Suspense>
      <HomeOrgFaqJsonLd />
      <HomeWebSiteJsonLd />
      <SiteChrome>
        <HeroSection />
        <PlannerPreview />
        <HowItWorks />
        <PlannerCtaBand />
        <CatalogBrowseSection latestTerm={latestTerm} />
        {/* <TopSubjects latestTerm={latestTerm} /> */}
        <LaramieCallout />
        <LandingFaq />
      </SiteChrome>
      <LandingFooter latestTerm={latestTerm} />
    </>
  );
}
