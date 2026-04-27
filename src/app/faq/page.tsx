import type { Metadata } from "next";
import Link from "next/link";
import { SiteChrome } from "@/components/seo/SiteChrome";
import { HOME_FAQ_ITEMS } from "@/lib/seo/home-faq";
import { absoluteUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about uwyoschedule, catalog data freshness, registration, and how the planner works.",
  alternates: { canonical: "/faq" },
  openGraph: {
    url: absoluteUrl("/faq"),
    title: "FAQ · uwyoschedule",
  },
};

export default function FaqPage() {
  return (
    <SiteChrome>
      <main className="mx-auto max-w-prose px-4 py-10 sm:px-6">
        <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          Frequently asked questions
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Same answers as on the home page, collected here for easy sharing.
        </p>
        <dl className="mt-10 space-y-8">
          {HOME_FAQ_ITEMS.map((item) => (
            <div key={item.question}>
              <dt className="font-medium text-foreground">{item.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-12 text-sm text-muted-foreground">
          <Link className="text-primary underline-offset-4 hover:underline" href="/">
            Home
          </Link>
          {" · "}
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/planner"
          >
            Planner
          </Link>
          {" · "}
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/about"
          >
            About
          </Link>
        </p>
      </main>
    </SiteChrome>
  );
}
