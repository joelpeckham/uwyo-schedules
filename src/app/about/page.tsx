import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteChrome } from "@/components/seo/SiteChrome";
import { absoluteUrl } from "@/lib/seo/site";
import { uwyoschedulePublisher } from "@/lib/seo/schema-org";

export const metadata: Metadata = {
  title: "About uwyoschedule",
  description:
    "uwyoschedule is an independent University of Wyoming class schedule planner for UW students. Built in Laramie. Not affiliated with UW.",
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
    dateModified: "2025-04-27",
  };

  return (
    <SiteChrome>
      <div className="mx-auto max-w-prose px-4 py-10 sm:px-6">
        <JsonLd data={articleJson} />
        <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          About uwyoschedule
        </h1>
        <p className="mt-6 text-pretty text-base leading-relaxed text-muted-foreground">
          uwyoschedule helps UW students turn a course list into a weekly
          schedule that works. You add the classes you want. The planner finds a
          conflict-free week that respects your busy times and instructor
          preferences. You refine it with pins and same-type swaps on the
          calendar.
        </p>
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
          This site is not affiliated with the University of Wyoming. We read
          the public UW course catalog, store it for speed, and rerun the
          solver as your course list, preferences, or busy times change.
        </p>
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
          Confirm anything that matters for registration in official UW systems:
          prerequisites, linked labs, holds, and seat counts.
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
      </div>
    </SiteChrome>
  );
}
