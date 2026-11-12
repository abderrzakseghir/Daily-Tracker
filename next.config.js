/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }],
  },
  async redirects() {
    return [
      // Anciennes routes
      { source: '/timeblocking', destination: '/planning', permanent: true },
      { source: '/jira-connect', destination: '/settings', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
