import NextLink, { type LinkProps } from "next/link";
import type { ComponentProps } from "react";

type AppLinkProps = LinkProps &
  Omit<ComponentProps<"a">, keyof LinkProps> & {
    /** Opt in to viewport prefetch; default is false to avoid unused preload warnings. */
    prefetch?: boolean;
  };

/**
 * Site-wide Link with prefetch disabled by default. Use on link-dense pages;
 * pair with `router.prefetch(href)` on hover for high-intent nav (see HeaderNav).
 */
export function AppLink({ prefetch = false, ...props }: AppLinkProps) {
  return <NextLink prefetch={prefetch} {...props} />;
}
