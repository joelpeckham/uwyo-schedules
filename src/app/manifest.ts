import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION_SHORT } from "@/lib/seo/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "uwyoschedule",
    short_name: "uwyoschedule",
    description: SITE_DESCRIPTION_SHORT,
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7F0",
    theme_color: "#C4733F",
    icons: [
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
