'use client'

import { useEffect } from 'react'
import ErrorState from '@/components/ui/ErrorState'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[hibou] Unhandled global error:', error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <ErrorState
          title="Something went wrong"
          message="We couldn’t load this page. Please try again or return to the world map."
          showRetry
          onRetry={reset}
          digest={error.digest}
          background="#0d0a08"
          textColor="#f6efe7"
          mutedColor="#d8cfc6"
          borderColor="#2b241f"
          accentColor="#7fb069"
        />
      </body>
    </html>
  )
}
