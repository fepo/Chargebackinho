import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["docx"],
  output: "standalone",
};

export default nextConfig;
