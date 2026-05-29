import type { Metadata } from "next";
import { AppLink } from "@/components/seo/AppLink";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { SiteChrome } from "@/components/seo/SiteChrome";
import { absoluteUrl } from "@/lib/seo/site";
import {
  listInstructorsIndexForSeo,
  listSectionsForInstructorForSeo,
  subjectToPathSegment,
} from "@/lib/seo/queries";

type Props = { params: Promise<{ slug: string }> };

const enabled =
  process.env.SEO_INSTRUCTOR_PAGES === "1" ||
  process.env.SEO_INSTRUCTOR_PAGES === "true";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!enabled) {
    return { title: "Instructors", robots: { index: false, follow: false } };
  }
  const index = await listInstructorsIndexForSeo(3);
  const row = index.find((r) => r.slug === slug);
  const canonical = `/instructors/${encodeURIComponent(slug)}`;
  return {
    title: row ? `${row.displayName} — sections` : "Instructor",
    description: row
      ? `Sections associated with ${row.displayName} in the UW course catalog cached by uwyoschedule.`
      : "Instructor index.",
    alternates: { canonical },
    robots: row ? undefined : { index: false, follow: false },
    openGraph: row
      ? { url: absoluteUrl(canonical), title: `${row.displayName} · uwyoschedule` }
      : undefined,
  };
}

export default async function InstructorPage({ params }: Props) {
  if (!enabled) notFound();

  const { slug } = await params;
  const index = await listInstructorsIndexForSeo(3);
  const row = index.find((r) => r.slug === slug);
  if (!row) notFound();

  const { rows } = await listSectionsForInstructorForSeo(row.displayName, slug);

  const canonicalPath = `/instructors/${encodeURIComponent(slug)}`;
  const personJson = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: row.displayName,
    url: absoluteUrl(canonicalPath),
    jobTitle: "Instructor",
    worksFor: { "@type": "Organization", name: "University of Wyoming" },
  };

  return (
    <SiteChrome>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:max-w-[90rem]">
        <JsonLd data={personJson} />
        <SeoBreadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: row.displayName, href: canonicalPath },
          ]}
        />
        <h1 className="mt-4 font-heading text-3xl font-medium text-foreground sm:text-4xl">
          {row.displayName}
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground sm:text-base">
          Sections in our catalog cache that list this instructor ({rows.length}{" "}
          shown). Names and assignments can change in the UW course catalog; this is not an
          official directory.
        </p>
        <ul className="mt-8 space-y-3 text-sm">
          {rows.map((r) => (
            <li
              key={`${r.termCode}-${r.crn}`}
              className="rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-muted-foreground">{r.termDescription}</span>
                <AppLink
                  className="font-mono font-medium text-primary underline-offset-4 hover:underline"
                  href={`/courses/${encodeURIComponent(subjectToPathSegment(r.subject))}/${encodeURIComponent(r.courseNumber.toLowerCase())}`}
                >
                  {r.subject} {r.courseNumber}
                </AppLink>
                <span className="text-muted-foreground">
                  {r.courseTitle ?? ""}
                </span>
              </div>
              {r.scheduleTypeDescription ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.scheduleTypeDescription}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </SiteChrome>
  );
}
