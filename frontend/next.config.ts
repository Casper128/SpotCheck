import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@spotcheck/shared"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
