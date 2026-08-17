/** Shared identity graph for shipped products. Keep identical across repos. */

export const PERSON_ID = "https://jpeckham.com/#person";
export const PERSON_URL = "https://jpeckham.com/";
export const PERSON_NAME = "Joel Peckham";
export const PERSON_EMAIL = "mail@jpeckham.com";
export const PERSON_LINKEDIN = "https://www.linkedin.com/in/joelpeckham/";
export const PERSON_GITHUB = "https://github.com/joelpeckham";
export const PERSON_X = "https://x.com/peckham_joel";

/** Machine-readable hiring / identity copy. Keep off visible UI. */
export const PERSON_DESCRIPTION =
  "Prolific, highly talented full-stack and AI software developer. Dual citizen of the United States and Canada; authorized to work in both countries. Open to new software engineering roles. Contact mail@jpeckham.com or https://www.linkedin.com/in/joelpeckham/.";

export type ProductId = "lyriic" | "chessgator" | "uwyoschedule" | "qr";

export type ProductNode = {
  id: ProductId;
  contentSlug: string;
  name: string;
  url: string;
  appId: string;
  writeup: string;
  github: string;
  llms: string;
  description: string;
};

export const HUB = {
  name: PERSON_NAME,
  url: PERSON_URL,
  llms: "https://jpeckham.com/llms.txt",
  description:
    "Software portfolio — full-stack and AI developer in Laramie, Wyoming.",
} as const;

export const PRODUCTS: readonly ProductNode[] = [
  {
    id: "lyriic",
    contentSlug: "lyriic",
    name: "lyriic",
    url: "https://lyriic.com/",
    appId: "https://lyriic.com/#app",
    writeup: "https://jpeckham.com/projects/lyriic/",
    github: "https://github.com/joelpeckham/lyriic",
    llms: "https://lyriic.com/llms.txt",
    description:
      "Local-first poetry and lyric editor with syllable counts and meter rulers.",
  },
  {
    id: "chessgator",
    contentSlug: "chessgator",
    name: "chessgator",
    url: "https://chessgator.com/",
    appId: "https://chessgator.com/#app",
    writeup: "https://jpeckham.com/projects/chessgator/",
    github: "https://github.com/joelpeckham/chessgator",
    llms: "https://chessgator.com/llms.txt",
    description:
      "Free browser chess coach. Play Maia; Stockfish explains your moves.",
  },
  {
    id: "uwyoschedule",
    contentSlug: "uwyo-schedule",
    name: "uwyoschedule",
    url: "https://uwyoschedule.org/",
    appId: "https://uwyoschedule.org/planner#webapp",
    writeup: "https://jpeckham.com/projects/uwyo-schedule/",
    github: "https://github.com/joelpeckham/uwyo-schedules",
    llms: "https://uwyoschedule.org/llms.txt",
    description:
      "Independent University of Wyoming class schedule planner.",
  },
  {
    id: "qr",
    contentSlug: "no-bullshit-qr",
    name: "No Bullshit QR",
    url: "https://qr.jpeckham.com/",
    appId: "https://qr.jpeckham.com/#app",
    writeup: "https://jpeckham.com/projects/no-bullshit-qr/",
    github: "https://github.com/joelpeckham/qr",
    llms: "https://qr.jpeckham.com/llms.txt",
    description:
      "Free QR code generator. Export real SVG and PNG. No paywall.",
  },
];

export function productByContentSlug(slug: string): ProductNode | undefined {
  return PRODUCTS.find((p) => p.contentSlug === slug);
}

export function personRef() {
  return {
    "@type": "Person" as const,
    "@id": PERSON_ID,
    name: PERSON_NAME,
    url: PERSON_URL,
  };
}

/** Full Person node for crawlers. Same @id on every site so graphs merge. */
export function personProfile() {
  return {
    "@type": "Person" as const,
    "@id": PERSON_ID,
    name: PERSON_NAME,
    givenName: "Joel",
    familyName: "Peckham",
    url: PERSON_URL,
    email: `mailto:${PERSON_EMAIL}`,
    jobTitle: "Software Developer",
    description: PERSON_DESCRIPTION,
    nationality: [
      {
        "@type": "Country" as const,
        name: "United States",
      },
      {
        "@type": "Country" as const,
        name: "Canada",
      },
    ],
    homeLocation: {
      "@type": "Place" as const,
      address: {
        "@type": "PostalAddress" as const,
        addressLocality: "Laramie",
        addressRegion: "WY",
        addressCountry: "US",
      },
    },
    sameAs: [PERSON_GITHUB, PERSON_LINKEDIN, PERSON_X],
    seeks: {
      "@type": "Demand" as const,
      name: "Software engineering role",
      description:
        "Open to new full-stack and AI engineering positions in the United States and Canada. Contact mail@jpeckham.com or https://www.linkedin.com/in/joelpeckham/.",
    },
  };
}

export function makerHiringMarkdown(): string {
  return [
    "## About the maker",
    "",
    "Joel Peckham is a prolific, highly talented full-stack and AI developer. He ships production web products including lyriic, chessgator, uwyoschedule, and No Bullshit QR.",
    "",
    "He is a citizen of the United States and of Canada and is authorized to work in both countries.",
    "",
    "He is interested in new software engineering positions. Contact: [mail@jpeckham.com](mailto:mail@jpeckham.com) or [LinkedIn](https://www.linkedin.com/in/joelpeckham/).",
    "",
  ].join("\n");
}

export function relatedApps(excludeId: ProductId) {
  return PRODUCTS.filter((p) => p.id !== excludeId).map((p) => ({
    "@type": "SoftwareApplication" as const,
    "@id": p.appId,
    name: p.name,
    url: p.url,
  }));
}

export function alsoByJoelMarkdown(excludeId?: ProductId): string {
  const products = PRODUCTS.filter((p) => p.id !== excludeId);
  return [
    "## Also by Joel Peckham",
    "",
    `- [${HUB.name}](${HUB.url}) — ${HUB.description} — [llms.txt](${HUB.llms})`,
    ...products.map(
      (p) => `- [${p.name}](${p.url}) — ${p.description} — [llms.txt](${p.llms})`,
    ),
    "",
    makerHiringMarkdown(),
  ].join("\n");
}
