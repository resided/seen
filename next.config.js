/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/019b19f2-6ca6-3bb7-c3e0-f374fc02f670',
        permanent: false, // 307 temporary redirect
      },
    ]
  },
}

module.exports = nextConfig

