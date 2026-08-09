import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdfjs-dist"],
  experimental: { proxyClientMaxBodySize: "50mb" },
  agentRules: false,
};

export default nextConfig;
