"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  {
    href: "/planner",
    label: "Planner",
    match: (p: string) => p === "/planner" || p.startsWith("/planner/"),
  },
  {
    href: "/courses",
    label: "Courses",
    match: (p: string) => p.startsWith("/courses"),
  },
  {
    href: "/terms",
    label: "Terms",
    match: (p: string) => p.startsWith("/terms"),
  },
  { href: "/about", label: "About", match: (p: string) => p === "/about" },
  { href: "/faq", label: "FAQ", match: (p: string) => p === "/faq" },
] as const;

function NavLink({
  href,
  label,
  active,
  onNavigate,
  className,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "underline-offset-4 hover:underline",
        active
          ? "font-semibold text-foreground"
          : "font-medium text-muted-foreground hover:text-primary",
        className,
      )}
    >
      {label}
    </Link>
  );
}

export function HeaderNav({ actions }: { actions?: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
      <nav
        aria-label="Site"
        className="hidden flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:flex"
      >
        {nav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            active={item.match(pathname)}
          />
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="touch-manipulation sm:hidden"
              aria-label="Open menu"
            >
              <Menu className="mr-1.5 size-4" aria-hidden />
              Menu
            </Button>
          </DialogTrigger>
          <DialogContent
            className="top-4 left-4 max-h-[min(32rem,calc(100vh-2rem))] w-[min(22rem,calc(100%-2rem))] max-w-none translate-x-0 translate-y-0 gap-0 border-border p-0 data-closed:zoom-out-100 data-open:zoom-in-100"
            showCloseButton
          >
            <DialogHeader className="border-b border-border px-4 py-3 text-left">
              <DialogTitle className="font-heading text-base font-medium">
                Menu
              </DialogTitle>
            </DialogHeader>
            <nav
              aria-label="Site"
              className="flex flex-col gap-1 px-2 py-3 text-sm"
            >
              {nav.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={item.match(pathname)}
                  onNavigate={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2.5 no-underline hover:bg-muted"
                />
              ))}
            </nav>
          </DialogContent>
        </Dialog>

        <ThemeToggle />

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-border sm:pl-6">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
