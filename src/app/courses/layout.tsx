import type { ReactNode } from "react";
import { SiteChrome } from "@/components/seo/SiteChrome";

export default function CoursesLayout({ children }: { children: ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
