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
}

module.exports = nextConfig

