import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Playwright uses 127.0.0.1; phone-on-LAN uses the machine’s LAN IP. Next dev
  // blocks cross-origin HMR to other origins without this.
  allowedDevOrigins: ["127.0.0.1", "192.168.4.92"],
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
