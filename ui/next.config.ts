import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The cockpit is a server-rendered Next app (NOT a static export) because it
  // hits the local API on every page. Output: undefined → standard Next runtime.
  typedRoutes: false,
};

export default nextConfig;
