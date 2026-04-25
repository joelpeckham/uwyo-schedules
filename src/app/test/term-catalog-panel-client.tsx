"use client";

import { useEffect, useState } from "react";
import type { TermCatalogBundle } from "@/lib/catalog/bundle";
import { fetchTermCatalogBundle } from "@/lib/catalog/fetch-term-catalog";
import { TermCatalogBrowser } from "./term-catalog-browser";

function TermCatalogPanelLoaded({
  catalogPathname,
  termCode,
  termDescription,
}: {
  catalogPathname: string;
  termCode: string;
  termDescription?: string;
}) {
  const [bundle, setBundle] = useState<TermCatalogBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTermCatalogBundle(catalogPathname, { termDescription })
      .then((b) => {
        if (cancelled) return;
        if (b.termCode !== termCode) {
          setErr(
            `Term code mismatch (expected ${termCode}, catalog has ${b.termCode}).`
          );
          return;
        }
        setBundle(b);
        setErr(null);
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
          setBundle(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [catalogPathname, termCode, termDescription]);

  if (err) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {err}
      </p>
    );
  }
  if (!bundle) {
    return (
      <p className="text-muted-foreground animate-pulse text-sm">
        Loading term {termCode}…
      </p>
    );
  }
  return <TermCatalogBrowser bundle={bundle} />;
}

export function TermCatalogPanelClient({
  catalogPathname,
  termCode,
  termDescription,
}: {
  catalogPathname: string | null;
  termCode: string;
  termDescription?: string;
}) {
  if (!catalogPathname) {
    return (
      <p className="text-destructive text-sm" role="alert">
        No termCatalog artifact in manifest. Re-run the scrape workflow to
        produce catalog.json.gz per term.
      </p>
    );
  }
  return (
    <TermCatalogPanelLoaded
      key={catalogPathname}
      catalogPathname={catalogPathname}
      termCode={termCode}
      termDescription={termDescription}
    />
  );
}
