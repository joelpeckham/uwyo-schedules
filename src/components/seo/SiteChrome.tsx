import Image from "next/image";
import Link from "next/link";

const nav = [
  { href: "/", label: "Planner" },
  { href: "/courses", label: "Courses" },
  { href: "/terms", label: "Terms" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
] as const;

export function SiteChrome({ children }: { children: React.ReactNode }) {
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
          <nav
            aria-label="Site"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-foreground/90 underline-offset-4 hover:text-primary hover:underline"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
