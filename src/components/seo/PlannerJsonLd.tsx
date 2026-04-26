import { JsonLd } from "@/components/seo/JsonLd";
import { absoluteUrl } from "@/lib/seo/site";

export function PlannerJsonLd() {
  const app = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": absoluteUrl("/planner#webapp"),
    name: "uwyoschedule planner",
    url: absoluteUrl("/planner"),
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    browserRequirements: "Requires JavaScript.",
    publisher: { "@id": absoluteUrl("/#organization") },
  };

  return <JsonLd data={app} />;
}
