import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ctpcoegmosyghjpukodr.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Fix for dev tunnel server actions
  serverExternalPackages: ['@supabase/supabase-js'],
  // Allow dev tunnel headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'x-forwarded-host',
            value: '*',
          },
          {
            key: 'x-forwarded-proto',
            value: '*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
