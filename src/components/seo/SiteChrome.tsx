import { Suspense, type ReactNode } from "react";
import Link from "next/link";

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
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:max-w-[90rem]">
          <Link
            href="/"
            className="inline-flex items-center gap-2 shrink-0"
            aria-label="uwyoschedule home"
          >
            <LogoWordmark className="shrink-0" />
          </Link>
          {/* `HeaderNav` calls `usePathname()` for active-link styling, which
              is uncached/dynamic data under Cache Components. Wrap it in a
              boundary so the surrounding shell can still prerender. */}
          <Suspense fallback={null}>
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
    </div>
  );
}
