import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // ✅ don't fail Vercel builds on lint issues
    ignoreDuringBuilds: true,
  },
  // Optional: if you hit stray type errors in CI you can flip this on temporarily
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;