import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite (demo database) and pg are Node-only and must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // The demo database applies SQL migrations from disk at runtime.
  outputFileTracingIncludes: { "/**": ["./supabase/migrations/**/*.sql"] },
  poweredByHeader: false,
};

export default nextConfig;
