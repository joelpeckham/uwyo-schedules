import type { Metadata } from "next";
import Link from "next/link";
import { createDb } from "@/db/index";
import { listTerms } from "@/lib/planner/data";
import { absoluteUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "UW Banner terms",
  description:
    "Browse University of Wyoming Banner terms available in uwyoschedule — pick a term to explore subjects and courses.",
  alternates: { canonical: "/terms" },
  openGraph: { url: absoluteUrl("/terms"), title: "UW Banner terms · uwyoschedule" },
};

export default async function TermsIndexPage() {
  const db = createDb();
  const terms = await listTerms(db);
  if (terms.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-heading text-3xl font-medium text-foreground">
          Terms
        </h1>
        <p className="mt-4 text-muted-foreground">
          No terms in the database yet. Run an ingest job, then reload.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        Banner terms
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        Each term links to a subject index sourced from our latest Banner sync.
      </p>
      <ul className="mt-8 space-y-3">
        {terms.map((t) => (
          <li key={t.code}>
            <Link
              href={`/terms/${encodeURIComponent(t.code)}`}
              className="text-base font-medium text-primary underline-offset-4 hover:underline"
            >
              {t.description}
            </Link>
            <span className="ml-2 font-mono text-sm text-muted-foreground">
              {t.code}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
