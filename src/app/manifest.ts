import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "uwyoschedule",
    short_name: "uwyoschedule",
    description:
      "Build a University of Wyoming class schedule that fits, fast and automatic.",
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
