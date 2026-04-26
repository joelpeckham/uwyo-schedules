import { JsonLd } from "@/components/seo/JsonLd";
import { HOME_FAQ_ITEMS } from "@/lib/seo/home-faq";
import { absoluteUrl } from "@/lib/seo/site";

/** Organization + FAQPage for the marketing home (`/`). WebApplication lives on `/planner` via PlannerJsonLd. */
export function HomeOrgFaqJsonLd() {
  const org = {
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: "uwyoschedule",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/logo-wordmark.svg"),
    description:
      "Independent University of Wyoming class schedule planner built for UW students.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Laramie",
      addressRegion: "WY",
      addressCountry: "US",
    },
    sameAs: ["https://www.uwyo.edu/"],
  };

  const faq = {
    "@type": "FAQPage",
    mainEntity: HOME_FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return <JsonLd data={[org, faq]} />;
}
