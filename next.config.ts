import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen in this app is behind a login and shows live booking data,
  // so pages render per request. Cache Components would add no benefit.
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
