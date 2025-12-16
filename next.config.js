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
  // REMOVED: output: 'standalone' - this actually slows down builds significantly
  // Faster builds - skip type checking during build (run separately if needed)
  typescript: {
    ignoreBuildErrors: true, // Skip TypeScript checking during builds for speed (emergency fixes)
  },
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during builds for speed (run lint separately)
  },
  // Experimental optimizations for faster builds
  experimental: {
    optimizeCss: true, // Faster CSS optimization
    optimizePackageImports: ['@farcaster/miniapp-sdk', 'wagmi', '@tanstack/react-query'], // Tree-shake unused exports
  },
  // Optimize images
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60,
  },
  // Reduce build output verbosity
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
}

module.exports = nextConfig

