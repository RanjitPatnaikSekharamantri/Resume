import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mammoth", "docx", "jszip"],
};

export default nextConfig;
