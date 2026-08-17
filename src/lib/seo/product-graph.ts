/** Shared identity graph for shipped products. Keep identical across repos. */

export const PERSON_ID = "https://jpeckham.com/#person";
export const PERSON_URL = "https://jpeckham.com/";
export const PERSON_NAME = "Joel Peckham";

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
  ].join("\n");
}
