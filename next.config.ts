// next.config.ts
import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // Turbopack config at top level (Next.js 16 — moved from experimental.turbopack)
  turbopack: {},

  // Allow Supabase storage domain for any future image assets
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
}

export default withSentryConfig(
  nextConfig,
  {
    silent: true,
  },
  {
    hideSourceMaps: true,
    disableLogger: true,
  }
)
