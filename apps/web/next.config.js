/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@coin-economy/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
}

module.exports = nextConfig
