import path from 'node:path';
import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Staff tools never belong in search results.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (only the files the app needs).
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@nixzora/validation', '@nixzora/ui'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
