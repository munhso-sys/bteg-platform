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
