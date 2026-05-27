import type { Metadata } from "next";
import { Suspense } from "react";
import { PrintBootstrap } from "@/components/planner/PrintBootstrap";
import {
  getLatestTermCodeForSeo,
  listTermsForSeo,
} from "@/lib/seo/queries";

export const metadata: Metadata = {
  title: "Print schedule",
  description: "Printable view of your weekly UW schedule.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/planner/print" },
};

async function PrintBody({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const [terms, latest, sp] = await Promise.all([
    listTermsForSeo(),
    getLatestTermCodeForSeo(),
    searchParams,
  ]);
  const termFromQuery =
    sp.term && terms.some((t) => t.code === sp.term) ? sp.term : null;
  const termCode =
    termFromQuery ?? latest ?? (terms.length > 0 ? terms[0]!.code : "");
  const termRow = terms.find((t) => t.code === termCode) ?? null;

  return (
    <PrintBootstrap
      termCode={termCode}
      termDescription={termRow?.description ?? null}
    />
  );
}

export default function PlannerPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; p?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-muted-foreground">
          Preparing schedule&hellip;
        </p>
      }
    >
      <PrintBody searchParams={searchParams} />
    </Suspense>
  );
}
