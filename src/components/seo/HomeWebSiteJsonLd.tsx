import { JsonLd } from "@/components/seo/JsonLd";
import {
  LANDING_DESCRIPTION_SHORT,
  absoluteUrl,
} from "@/lib/seo/site";

/** WebSite + SearchAction for the marketing home (`/`). */
export function HomeWebSiteJsonLd() {
  const website = {
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: "uwyoschedule",
    url: absoluteUrl("/"),
    description: LANDING_DESCRIPTION_SHORT,
    publisher: { "@id": absoluteUrl("/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/courses/{search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };

  return <JsonLd data={website} />;
}
