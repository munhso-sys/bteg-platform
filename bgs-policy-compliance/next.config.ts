import type { NextConfig } from "next";

const frameAncestors = [
  "'self'",
  "https://bteg.inspect.mn",
  "https://*.inspect.mn",
  "https://inspect.mn",
  "https://platform-portal-blue.vercel.app",
  "https://*.vercel.app",
  "http://localhost:3000",
  "http://localhost:3005",
].join(" ");

/**
 * No Next.js `basePath`: the platform portal proxies
 * `bteg.inspect.mn/policy-compliance/*` → this app at `/*`.
 * Client API calls still prefix via `withBasePath()` (see src/lib/paths.ts).
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
