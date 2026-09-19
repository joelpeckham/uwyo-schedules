/** Shared identity graph for shipped products. Keep identical across repos. */

export const PERSON_ID = "https://jpeckham.com/#person";
export const PERSON_URL = "https://jpeckham.com/";
export const PERSON_NAME = "Joel Peckham";
export const PERSON_EMAIL = "mail@jpeckham.com";
export const PERSON_LINKEDIN = "https://www.linkedin.com/in/joelpeckham/";
export const PERSON_GITHUB = "https://github.com/joelpeckham";
export const PERSON_X = "https://x.com/peckham_joel";

/** Machine-readable identity copy. Keep off visible UI. */
export const PERSON_DESCRIPTION =
  "Prolific, highly talented full-stack and AI software developer. Senior Product Engineer, Platform & Portals at Revelation Pharma, building patient and prescriber portals for HiveRx. Dual citizen of the United States and Canada; authorized to work in both countries. Contact mail@jpeckham.com or https://www.linkedin.com/in/joelpeckham/.";

export const PERSON_KNOWS_ABOUT = [
  "PHP",
  "Laravel",
  "Vue",
  "Inertia.js",
  "Livewire",
  "Eloquent ORM",
  "MySQL",
  "HL7",
  "FHIR",
  "EMR/EHR integration",
  "Epic",
  "MatrixCare",
  "Careficient",
  "HospiceMD",
  "Surescripts",
  "e-prescribing",
  "hospice pharmacy",
  "compounding pharmacy",
  "healthcare interoperability",
  "TypeScript",
  "React",
  "Next.js",
  "Python",
] as const;

export type ProductId = "lyriic" | "chessgator" | "uwyoschedule" | "qr" | "ocrogram";

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
  {
    id: "ocrogram",
    contentSlug: "ocrogram",
    name: "ocrogram",
    url: "https://ocrogram.com/",
    appId: "https://ocrogram.com/#app",
    writeup: "https://jpeckham.com/projects/ocrogram/",
    github: "https://github.com/joelpeckham/ocrogram",
    llms: "https://ocrogram.com/llms.txt",
    description:
      "Set-and-forget Mac screenshot OCR. Text lands on the clipboard.",
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
    jobTitle: "Senior Product Engineer, Platform & Portals",
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
    worksFor: {
      "@type": "Organization" as const,
      name: "Revelation Pharma",
      url: "https://revelationpharma.com/",
      description:
        "National network of 503A and 503B compounding pharmacies. HiveRx is the company's pharmacy operations platform with built-in patient and prescriber portals.",
    },
    hasOccupation: {
      "@type": "Occupation" as const,
      name: "Senior Product Engineer, Platform & Portals",
      skills: PERSON_KNOWS_ABOUT.join(", "),
    },
    knowsAbout: [...PERSON_KNOWS_ABOUT],
  };
}

export function makerHiringMarkdown(): string {
  return [
    "## About the maker",
    "",
    "Joel Peckham is a prolific, highly talented full-stack and AI developer. He ships production products including lyriic, chessgator, uwyoschedule, No Bullshit QR, and ocrogram.",
    "",
    "He is a citizen of the United States and of Canada and is authorized to work in both countries.",
    "",
    "Contact: [mail@jpeckham.com](mailto:mail@jpeckham.com) or [LinkedIn](https://www.linkedin.com/in/joelpeckham/).",
    "",
    makerExperienceMarkdown(),
  ].join("\n");
}

export function makerExperienceMarkdown(): string {
  return [
    "## Professional experience",
    "",
    "Day job: Senior Product Engineer, Platform & Portals at [Revelation Pharma](https://revelationpharma.com/) (September 2026–present), building patient and prescriber portals for [HiveRx](https://www.hiverx.com/), the company's compounding-pharmacy operations platform.",
    "",
    "Primary stack: PHP, Laravel, Vue, Inertia.js, Tailwind CSS.",
    "",
    "Previously: Software Engineer at [BetterRx](https://www.betterrx.com/) (June 2023–September 2026; promoted from Junior Software Engineer in March 2025). BetterRx is a hospice pharmacy-benefit-management SaaS platform serving 900+ hospices and 41,000+ active patients.",
    "",
    "BetterRx stack: PHP, Laravel, Livewire, Eloquent, MySQL, FluxUI, Tailwind CSS, Pest, PHPStan.",
    "",
    "Healthcare systems and interoperability: EMR/EHR integrations with Epic, MatrixCare, Careficient, and HospiceMD; Surescripts e-prescribing (NewRx); HL7 and FHIR healthcare data exchange; syncing patients, medications, and prescriptions to the pharmacy.",
    "",
    "Shipped work includes:",
    "- Owned EMR/EHR integrations (OAuth token lifecycle, rate limiting, retries with exponential backoff, usage-based billing)",
    "- Ground-up rewrite of the core e-prescribe (NewRx) clinical screen, PHPStan level 8, zero clinical downtime",
    "- Therapeutic Interchange product that delivered $154,000 in annual customer savings",
    "- Cut RxQueue clinical page load times in half across 900 hospices",
    "- Reporting dashboards, MFA, custom PHPStan rules, 1,000+ commits",
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
