import path from 'path';
import type { NextConfig } from 'next';
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  headers: async () => [{ source: '/(.*)', headers: securityHeaders }],
};
export default nextConfig;
