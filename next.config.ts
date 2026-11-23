import type { NextConfig } from "next";
const config: NextConfig = {
  output: process.env.KILLERWAVE_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  devIndicators: false,
  experimental: { proxyClientMaxBodySize: "97mb" },
  async rewrites() {
    return [{
      source: "/api/:path*",
      destination: `${process.env.KILLERWAVE_API_ORIGIN ?? "http://127.0.0.1:18080"}/api/:path*`,
    }];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};
export default config;
