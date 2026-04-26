import type { ReactNode } from "react";
import { SiteChrome } from "@/components/seo/SiteChrome";

export async function headers() {
  return {
    "Cache-Control":
      "public, s-maxage=3600, stale-while-revalidate=86400",
  };
}

export default function CoursesLayout({ children }: { children: ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
