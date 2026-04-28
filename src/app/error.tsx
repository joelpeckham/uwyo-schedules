"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SiteChrome } from "@/components/seo/SiteChrome";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RouteError({ error, reset }: Props) {
  useEffect(() => {
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <SiteChrome>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-16">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          We hit an unexpected error.
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
          The page you were viewing failed to load. It may have been a transient
          glitch — try again, or head back home.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">
            Error reference: {error.digest}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </main>
    </SiteChrome>
  );
}
