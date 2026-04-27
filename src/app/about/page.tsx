import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteChrome } from "@/components/seo/SiteChrome";
import { absoluteUrl } from "@/lib/seo/site";
import { uwyoschedulePublisher } from "@/lib/seo/schema-org";

export const metadata: Metadata = {
  title: "About uwyoschedule",
  description:
    "uwyoschedule is an independent University of Wyoming class schedule planner built for UW students — calm, fast, and rooted in Laramie.",
  alternates: { canonical: "/about" },
  openGraph: {
    url: absoluteUrl("/about"),
    title: "About uwyoschedule",
  },
};

export default function AboutPage() {
  const articleJson = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "About uwyoschedule",
    author: uwyoschedulePublisher(),
    publisher: uwyoschedulePublisher(),
    mainEntityOfPage: absoluteUrl("/about"),
    dateModified: new Date().toISOString().slice(0, 10),
  };

  return (
    <SiteChrome>
      <main className="mx-auto max-w-prose px-4 py-10 sm:px-6">
        <JsonLd data={articleJson} />
        <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          About uwyoschedule
        </h1>
        <p className="mt-6 text-pretty text-base leading-relaxed text-muted-foreground">
          uwyoschedule helps UW students go from a course list to a weekly
          schedule that actually works, without the back-and-forth of juggling
          catalog screens by hand. We are calm, focused, and built for Laramie —
          not generic ed-tech.
        </p>
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
          This site is not affiliated with the University of Wyoming. We read
          the public UW course catalog, cache it for speed, and run a solver on top
          so you can page through conflict-free schedules, set instructor
          preferences, and respect real-life busy times.
        </p>
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
          When something matters for registration — prerequisites, linked labs,
          holds, or seat counts — always confirm in official UW systems.
        </p>
        <p className="mt-8 text-sm text-muted-foreground">
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/planner"
          >
            Open the planner
          </Link>
          {" · "}
          <Link className="text-primary underline-offset-4 hover:underline" href="/faq">
            FAQ
          </Link>
        </p>
      </main>
    </SiteChrome>
  );
}
