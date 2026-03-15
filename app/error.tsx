'use client'
// app/error.tsx
// Root error boundary for all RSC data-fetch failures.
// Renders when repository.ts throws (e.g. Supabase is unreachable).
// Next.js App Router requires this to be a Client Component.

import { useEffect } from 'react'
import ErrorState from '@/components/ui/ErrorState'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Log to your error-tracking service here (e.g. Sentry)
    console.error('[hibou] Unhandled RSC error:', error)
  }, [error])

  return (
    <ErrorState
      title="Data load failed"
      message="We couldn’t reach the data service. If this persists, verify Supabase configuration."
      showRetry
      onRetry={reset}
      digest={error.digest}
    />
  )
}
