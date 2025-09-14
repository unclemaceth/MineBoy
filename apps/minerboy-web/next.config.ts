import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

// Use dynamic import for next-pwa to avoid TypeScript issues
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

export default withPWA(nextConfig);
