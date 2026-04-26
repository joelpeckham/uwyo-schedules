import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LaramieCallout } from "@/components/landing/LaramieCallout";
import { PlannerPreview } from "@/components/landing/PlannerPreview";
import { TopSubjects } from "@/components/landing/TopSubjects";
import { HomeOrgFaqJsonLd } from "@/components/seo/HomeOrgFaqJsonLd";
import { LandingFooter } from "@/components/seo/LandingFooter";
import { SiteChrome } from "@/components/seo/SiteChrome";
import { createDb } from "@/db/index";
import { getLatestTermCode } from "@/lib/planner/data";
import { absoluteUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "uwyoschedule — University of Wyoming class schedule planner",
  description:
    "Plan a University of Wyoming class schedule that fits your life. From course list to a conflict-free week in minutes — then open the planner to build yours.",
  alternates: { canonical: "/" },
  openGraph: {
    url: absoluteUrl("/"),
    title: "uwyoschedule — University of Wyoming class schedule planner",
    description:
      "Plan a UW class schedule that fits your life. Browse courses, then build a conflict-free week in the planner.",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const sp = await searchParams;
  if (sp.term != null && sp.term !== "") {
    redirect(`/planner?term=${encodeURIComponent(sp.term)}`);
  }

  const db = createDb();
  const latest = await getLatestTermCode(db);

  return (
    <>
      <HomeOrgFaqJsonLd />
      <SiteChrome>
        <HeroSection />
        <PlannerPreview />
        <HowItWorks />
        <LaramieCallout />
        <TopSubjects latestTermCode={latest} />
        <LandingFaq />
      </SiteChrome>
      <LandingFooter latestTermCode={latest} />
    </>
  );
}
