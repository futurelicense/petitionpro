import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "mammoth"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
