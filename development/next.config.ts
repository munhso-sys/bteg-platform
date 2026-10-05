import type { NextConfig } from "next";
import path from "path";

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

const nextConfig: NextConfig = {
  // Monorepo has a root package-lock.json; without this Turbopack resolves the
  // wrong workspace root and pages can 500 with ComponentMod.handler errors.
  turbopack: {
    root: path.join(__dirname),
  },
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
