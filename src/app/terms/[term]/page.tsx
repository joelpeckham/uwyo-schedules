import type { Metadata } from "next";
import { AppLink } from "@/components/seo/AppLink";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { absoluteUrl } from "@/lib/seo/site";
import {
  getTermDescriptionByCodeForSeo,
  listSubjectsForTermForSeo,
  listTermsForSeo,
  subjectToPathSegment,
  termExistsForSeo,
} from "@/lib/seo/queries";

type Props = { params: Promise<{ term: string }> };

export async function generateStaticParams() {
  const terms = await listTermsForSeo();
  return terms.map((t) => ({ term: t.code }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { term } = await params;
  const canonical = `/terms/${encodeURIComponent(term)}`;
  const label = (await getTermDescriptionByCodeForSeo(term)) ?? term;
  return {
    title: label,
    description: `Browse University of Wyoming subjects for ${label}.`,
    alternates: { canonical },
    openGraph: {
      url: absoluteUrl(canonical),
      title: `${label} · uwyoschedule`,
    },
  };
}

export default async function TermPage({ params }: Props) {
  const { term } = await params;
  if (!(await termExistsForSeo(term))) notFound();

  const [description, subjects] = await Promise.all([
    getTermDescriptionByCodeForSeo(term).then((d) => d ?? term),
    listSubjectsForTermForSeo(term),
  ]);
  const canonicalPath = `/terms/${encodeURIComponent(term)}`;

  const collectionJson = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: description,
    description: `University of Wyoming subjects for ${description}.`,
    url: absoluteUrl(canonicalPath),
    isPartOf: { "@type": "WebSite", name: "uwyoschedule", url: absoluteUrl("/") },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:max-w-[90rem]">
      <JsonLd data={collectionJson} />
      <SeoBreadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Terms", href: "/terms" },
          { name: description, href: canonicalPath },
        ]}
      />
      <h1 className="mt-4 font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        {description}
      </h1>
      <ul className="mt-8 columns-1 gap-3 sm:columns-2 lg:columns-3">
        {subjects.map((s) => (
          <li
            key={s.subject}
            className="mb-2 break-inside-avoid rounded-md border border-border bg-card px-3 py-2 shadow-sm"
          >
            <AppLink
              href={`/terms/${encodeURIComponent(term)}/${encodeURIComponent(subjectToPathSegment(s.subject))}`}
              className="font-mono text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {s.subject}
            </AppLink>
            <span className="ml-2 text-xs text-muted-foreground">
              {s.sectionCount} sections
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
