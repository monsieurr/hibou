// next.config.ts
import type { NextConfig } from 'next'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
let withSentryConfig:
  | ((config: NextConfig, ...args: Array<Record<string, unknown>>) => NextConfig)
  | undefined

try {
  // Optional dependency : app still runs without Sentry installed.
  ;({ withSentryConfig } = require('@sentry/nextjs'))
} catch {
  withSentryConfig = undefined
}

const nextConfig: NextConfig = {
  // Turbopack config at top level (Next.js 16 : moved from experimental.turbopack)
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

const sentryConfig = withSentryConfig
  ? withSentryConfig(
      nextConfig,
      {
        silent: true,
      },
      {
        hideSourceMaps: true,
        disableLogger: true,
      }
    )
  : nextConfig

export default sentryConfig
