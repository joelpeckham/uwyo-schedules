import { absoluteUrl } from "@/lib/seo/site";

export const uwyoOrganization = {
  "@type": "Organization" as const,
  name: "University of Wyoming",
  url: "https://www.uwyo.edu/",
  sameAs: ["https://www.uwyo.edu/"],
};

export function uwyoschedulePublisher() {
  return {
    "@type": "Organization" as const,
    name: "uwyoschedule",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/logo-wordmark.svg"),
  };
}
