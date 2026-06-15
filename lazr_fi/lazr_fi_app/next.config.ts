import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo root — flash-v2 lives outside lazr_fi_app but is linked via file: dep.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["flash-v2"],
  turbopack: {},
};

export default nextConfig;
