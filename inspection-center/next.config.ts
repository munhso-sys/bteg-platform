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
  // Keep seed JSON available to serverless functions on Vercel.
  outputFileTracingIncludes: {
    "/*": ["./data/**/*"],
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
