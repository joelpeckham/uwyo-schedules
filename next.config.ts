import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Playwright uses 127.0.0.1; phone-on-LAN uses the machine’s LAN IP. Next dev
  // blocks cross-origin HMR to other origins without this.
  allowedDevOrigins: ["127.0.0.1", "192.168.4.92"],
};

export default withWorkflow(nextConfig);
