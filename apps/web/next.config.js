/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@coin-economy/shared'],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

module.exports = nextConfig
