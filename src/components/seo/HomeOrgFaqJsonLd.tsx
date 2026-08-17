import { JsonLd } from "@/components/seo/JsonLd";
import { HOME_FAQ_ITEMS } from "@/lib/seo/home-faq";
import { personRef } from "@/lib/seo/product-graph";
import { SITE_DESCRIPTION_SHORT, absoluteUrl } from "@/lib/seo/site";

/** Organization + FAQPage for the marketing home (`/`). WebApplication lives on `/planner` via PlannerJsonLd. */
export function HomeOrgFaqJsonLd() {
  const person = personRef();
  const org = {
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: "uwyoschedule",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/logo-wordmark.svg"),
    description: SITE_DESCRIPTION_SHORT,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Laramie",
      addressRegion: "WY",
      addressCountry: "US",
    },
    founder: person,
    author: person,
    sameAs: [
      "https://jpeckham.com/projects/uwyo-schedule/",
      "https://github.com/joelpeckham/uwyo-schedules",
    ],
    about: {
      "@type": "CollegeOrUniversity",
      name: "University of Wyoming",
      url: "https://www.uwyo.edu/",
    },
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

  return <JsonLd data={[person, org, faq]} />;
}
