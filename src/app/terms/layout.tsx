import type { ReactNode } from "react";
import { SiteChrome } from "@/components/seo/SiteChrome";

export default function TermsLayout({ children }: { children: ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
