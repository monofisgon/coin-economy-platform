/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@coin-economy/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      react: require.resolve('react'),
      'react-dom': require.resolve('react-dom'),
    }
    return config
  },
}

module.exports = nextConfig
