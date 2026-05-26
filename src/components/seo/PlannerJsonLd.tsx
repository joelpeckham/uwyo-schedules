import { JsonLd } from "@/components/seo/JsonLd";
import { absoluteUrl } from "@/lib/seo/site";

const PLANNER_FEATURE_LIST = [
  "Conflict-free week calendar from live UW catalog data",
  "Busy-time blackouts and soft instructor preferences",
  "Section pins and same-type drag swaps",
  "Alternate conflict-free weeks with keep and compare",
  "Shareable planner links and calendar export",
  "Filters for open seats, TBA meetings, and online or async sections",
] as const;

export function PlannerJsonLd() {
  const app = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": absoluteUrl("/planner#webapp"),
    name: "uwyoschedule planner",
    url: absoluteUrl("/planner"),
    description:
      "University of Wyoming class schedule planner with a solver-backed conflict-free week, preferences, and calendar refinements.",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    featureList: [...PLANNER_FEATURE_LIST],
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    browserRequirements: "Requires JavaScript.",
    publisher: { "@id": absoluteUrl("/#organization") },
  };

  return <JsonLd data={app} />;
}
