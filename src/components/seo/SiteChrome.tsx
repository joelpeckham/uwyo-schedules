import { Suspense, type ReactNode } from "react";
import { AppLink } from "@/components/seo/AppLink";

import { HeaderNav } from "./HeaderNav";
import { LogoWordmark } from "./LogoWordmark";

export function SiteChrome({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-background">
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:max-w-[84rem]">
          <AppLink
            href="/"
            className="inline-flex items-center gap-2 shrink-0"
            aria-label="uwyoschedule home"
          >
            <LogoWordmark className="shrink-0" />
          </AppLink>
          {/* `HeaderNav` calls `usePathname()` for active-link styling, which
              is uncached/dynamic data under Cache Components. Wrap it in a
              boundary so the surrounding shell can still prerender. The
              fallback reserves the same height so the prerender doesn't
              shift when the client nav hydrates. */}
          <Suspense
            fallback={
              <div
                aria-hidden
                className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6"
              >
                <div className="hidden h-8 w-full items-center gap-x-4 gap-y-2 sm:flex" />
                <div className="flex h-8 flex-wrap items-center gap-2 sm:gap-4" />
              </div>
            }
          >
            <HeaderNav actions={actions} />
          </Suspense>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col outline-none focus:outline-none"
      >
        {children}
      </main>
      <footer className="border-t border-border px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-6xl lg:max-w-[84rem]">
          <p className="text-xs text-muted-foreground/60">
            Built by{" "}
            <a
              href="https://jpeckham.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/70 underline-offset-4 hover:text-primary hover:underline"
            >
              Joel Peckham
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
