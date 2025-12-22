/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // CRITICAL: Prevent server secrets from leaking to client
  // Only NEXT_PUBLIC_* vars should be available in browser
  env: {},
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // REMOVED X-Frame-Options for main app - Farcaster mini apps need to be embedded in iframes
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Prevent MIME sniffing
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block', // Enable XSS filter
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()', // Disable unnecessary permissions
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY', // API routes should never be framed
          },
        ],
      },
    ];
  },
  // Optimize build performance
  swcMinify: true, // Use SWC for faster minification
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep error/warn logs in production
    } : false,
  },
  // REMOVED: output: 'standalone' - this actually slows down builds significantly
  // Type checking and linting - RE-ENABLED for security
  // Run these checks to catch errors before they reach production
  typescript: {
    ignoreBuildErrors: false, // Enable TypeScript checking (security fix)
  },
  eslint: {
    ignoreDuringBuilds: false, // Enable ESLint checking (security fix)
  },
  // Experimental optimizations for faster builds
  experimental: {
    // optimizeCss requires critters package - removed to avoid build errors
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

