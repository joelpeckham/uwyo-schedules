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
import { absoluteUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "uwyoschedule — University of Wyoming class schedule planner",
  description:
    "Plan a University of Wyoming class schedule that fits your life. Add courses from the live catalog and watch a best conflict-free week stay in sync in the planner—pins, same-type swaps, and busy times included.",
  alternates: { canonical: "/" },
  openGraph: {
    url: absoluteUrl("/"),
    title: "uwyoschedule — University of Wyoming class schedule planner",
    description:
      "Plan a UW class schedule that fits your life. Browse courses, then open the planner for a live-updating conflict-free week.",
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
