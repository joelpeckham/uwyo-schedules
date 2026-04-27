import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { HeaderNav } from "./HeaderNav";

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
          <Link href="/" className="inline-flex items-center gap-2 shrink-0">
            <Image
              src="/brand/logo-wordmark.svg"
              alt="uwyoschedule home"
              width={160}
              height={32}
              className="text-primary"
              priority
              sizes="160px"
            />
          </Link>
          <HeaderNav actions={actions} />
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
