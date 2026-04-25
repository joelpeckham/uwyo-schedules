import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Playwright uses 127.0.0.1; Next dev blocks cross-origin HMR without this.
  allowedDevOrigins: ["127.0.0.1"],
};

export default withWorkflow(nextConfig);
