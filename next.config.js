/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Optimize build performance
  swcMinify: true, // Use SWC for faster minification
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep error/warn logs in production
    } : false,
  },
  // Reduce build output
  output: 'standalone', // Creates smaller deployment package
  // Faster builds - skip type checking during build (run separately if needed)
  typescript: {
    ignoreBuildErrors: false, // Keep this false for safety, but you can set to true for faster builds in emergencies
  },
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during builds for speed (run lint separately)
  },
  // Optimize images
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60,
  },
}

module.exports = nextConfig

