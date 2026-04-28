import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LaramieCallout } from "@/components/landing/LaramieCallout";
import { PlannerPreview } from "@/components/landing/PlannerPreview";
import { TopSubjects } from "@/components/landing/TopSubjects";
import { HomeOrgFaqJsonLd } from "@/components/seo/HomeOrgFaqJsonLd";
import { LandingFooter } from "@/components/seo/LandingFooter";
import { SiteChrome } from "@/components/seo/SiteChrome";
import { getLatestTermRowForSeo } from "@/lib/seo/queries";
import {
  SITE_DESCRIPTION,
  SITE_DESCRIPTION_SHORT,
  absoluteUrl,
} from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "uwyoschedule — University of Wyoming class schedule planner",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    url: absoluteUrl("/"),
    title: "uwyoschedule — University of Wyoming class schedule planner",
    description: SITE_DESCRIPTION_SHORT,
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
      <SiteChrome>
        <HeroSection />
        <PlannerPreview />
        <HowItWorks />
        <LaramieCallout />
        <TopSubjects latestTerm={latestTerm} />
        <LandingFaq />
      </SiteChrome>
      <LandingFooter latestTerm={latestTerm} />
    </>
  );
}
