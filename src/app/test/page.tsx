import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CatalogManifest } from "@/lib/banner-ssb/types";
import {
  loadLatestPointer,
  loadManifestForRun,
  manifestPathForTermCatalog,
} from "@/lib/catalog/load";
import { TermCatalogPanelClient } from "./term-catalog-panel-client";

/** Always read Blob at request time; never prerender catalog HTML at build. */
export const dynamic = "force-dynamic";

function assertTestPageAllowed() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.CATALOG_TEST_PAGE_ENABLED === "true") return;
  notFound();
}

type ResolvedManifest =
  | { ok: true; manifest: CatalogManifest; runId: string; updatedAt?: string }
  | { ok: false; message: string; runId: string | null };

async function resolveManifest(runIdParam: string | undefined): Promise<ResolvedManifest> {
  if (runIdParam) {
    const m = await loadManifestForRun(runIdParam);
    if (!m.ok) return { ok: false, message: m.message, runId: runIdParam };
    return {
      ok: true,
      manifest: m.manifest,
      runId: runIdParam,
      updatedAt: m.manifest.completedAt,
    };
  }
  const latest = await loadLatestPointer();
  if (!latest.ok) {
    return { ok: false, message: latest.message, runId: null };
  }
  const m = await loadManifestForRun(latest.pointer.runId);
  if (!m.ok) {
    return {
      ok: false,
      message: m.message,
      runId: latest.pointer.runId,
    };
  }
  return {
    ok: true,
    manifest: m.manifest,
    runId: latest.pointer.runId,
    updatedAt: latest.pointer.updatedAt,
  };
}

export default async function TestCatalogPage({
  searchParams,
}: {
  searchParams?: Promise<{ runId?: string }>;
}) {
  assertTestPageAllowed();

  const sp = (await searchParams) ?? {};
  const runIdParam =
    typeof sp.runId === "string" && sp.runId.length > 0 ? sp.runId : undefined;

  let manifestResult: ResolvedManifest;
  try {
    manifestResult = await resolveManifest(runIdParam);
  } catch {
    manifestResult = {
      ok: false,
      message:
        "Could not read Blob storage. Is BLOB_READ_WRITE_TOKEN set in .env.local?",
      runId: null,
    };
  }

  if (!manifestResult.ok) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <h1 className="font-heading text-2xl font-semibold">Catalog test</h1>
        <Card>
          <CardHeader>
            <CardTitle>Unable to load catalog</CardTitle>
            <CardDescription>
              {manifestResult.message}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            <p>
              After a successful scrape,{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                catalog-runs/catalog-latest.json
              </code>{" "}
              should exist in your Blob store.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { manifest, runId, updatedAt: resolvedUpdatedAt } = manifestResult;
  const headerRunId = runId;
  const updatedAt = resolvedUpdatedAt ?? manifest.completedAt;

  const kindCounts = manifest.blobs.reduce<Record<string, number>>((acc, b) => {
    acc[b.kind] = (acc[b.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 pb-16">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Catalog test</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Term catalogs load in the browser via{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            /api/catalog/term
          </code>{" "}
          (gzip). Optional query:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            ?runId=&lt;uuid&gt;
          </code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run</CardTitle>
          <CardDescription>
            {headerRunId}
            {updatedAt ? ` · updated ${updatedAt}` : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-wrap gap-2 text-xs">
          {Object.entries(kindCounts).map(([k, n]) => (
            <span key={k} className="rounded-md border px-2 py-1">
              {k}: {n}
            </span>
          ))}
        </CardContent>
      </Card>

      <Accordion type="multiple" className="w-full">
        {manifest.terms.map((t) => (
          <AccordionItem key={t.code} value={t.code}>
            <AccordionTrigger className="text-base">
              <span className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                <span className="font-mono text-sm">{t.code}</span>
                {t.description ? (
                  <span className="text-muted-foreground font-normal">
                    {t.description}
                  </span>
                ) : null}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <Suspense
                fallback={
                  <p className="text-muted-foreground animate-pulse text-sm">
                    Loading term {t.code}…
                  </p>
                }
              >
                <TermCatalogPanelClient
                  catalogPathname={manifestPathForTermCatalog(
                    manifest,
                    t.code
                  )}
                  termCode={t.code}
                  termDescription={t.description}
                />
              </Suspense>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </main>
  );
}
