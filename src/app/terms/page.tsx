import type { Metadata } from "next";
import { AppLink } from "@/components/seo/AppLink";
import { listTermsForSeo } from "@/lib/seo/queries";
import { absoluteUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "UW course terms",
  description:
    "Browse University of Wyoming terms available in uwyoschedule. Pick a term to see its subjects and courses.",
  alternates: { canonical: "/terms" },
  openGraph: { url: absoluteUrl("/terms"), title: "UW course terms · uwyoschedule" },
};

export default async function TermsIndexPage() {
  const terms = await listTermsForSeo();
  if (terms.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-heading text-3xl font-medium text-foreground">
          Terms
        </h1>
        <p className="mt-4 text-muted-foreground">
          No terms in the database yet. Run an ingest job, then reload.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        Terms
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        Each term links to a subject index sourced from our latest sync.
      </p>
      <ul className="mt-8 space-y-3">
        {terms.map((t) => (
          <li key={t.code}>
            <AppLink
              href={`/terms/${encodeURIComponent(t.code)}`}
              className="text-base font-medium text-primary underline-offset-4 hover:underline"
            >
              {t.description}
            </AppLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
