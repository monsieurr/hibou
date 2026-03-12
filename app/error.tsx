'use client'
// app/error.tsx
// Root error boundary for all RSC data-fetch failures.
// Renders when repository.ts throws (e.g. Supabase is unreachable).
// Next.js App Router requires this to be a Client Component.

import { useEffect } from 'react'

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
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '40px 24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <h2 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--text)',
        margin: 0,
      }}>
        Failed to load ESG data
      </h2>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--text-dim)',
        maxWidth: 460,
        lineHeight: 1.6,
        margin: 0,
      }}>
        The database could not be reached. This is usually temporary.
        {error.digest && (
          <span style={{ display: 'block', marginTop: 8, color: 'var(--muted)' }}>
            Error reference: {error.digest}
          </span>
        )}
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          onClick={reset}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '1px',
            background: 'transparent',
            border: '1px solid var(--accent-e)',
            color: 'var(--accent-e)',
            borderRadius: 5,
            padding: '8px 20px',
            cursor: 'pointer',
          }}
        >
          ↺ TRY AGAIN
        </button>
        <a
          href="/"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '1px',
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-dim)',
            borderRadius: 5,
            padding: '8px 20px',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          ← WORLD MAP
        </a>
      </div>
    </div>
  )
}
