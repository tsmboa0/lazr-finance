import path from "node:path";
import type { NextConfig } from "next";

const flashV2Shim = path.join(__dirname, "lib/flash-v2.ts");

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["flash-v2"],
  turbopack: {
    resolveAlias: {
      "flash-v2": "./lib/flash-v2.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "flash-v2": flashV2Shim,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
    };
    return config;
  },
};

export default nextConfig;
