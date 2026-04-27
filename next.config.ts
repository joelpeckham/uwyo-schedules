import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Playwright uses 127.0.0.1; optional DEV_LAN_ORIGIN for phone-on-LAN HMR.
  allowedDevOrigins: [
    "127.0.0.1",
    ...(process.env.DEV_LAN_ORIGIN?.trim()
      ? [process.env.DEV_LAN_ORIGIN.trim()]
      : []),
  ],
  async headers() {
    const security = [
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "SAMEORIGIN",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ] as const;
    const hsts =
      process.env.VERCEL === "1"
        ? ([
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains; preload",
            },
          ] as const)
        : [];
    return [
      {
        source: "/:path*",
        headers: [...hsts, ...security],
      },
    ];
  },
};

export default withWorkflow(nextConfig);
