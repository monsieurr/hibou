import Link from 'next/link'

interface Props {
  title: string
  message: string
  showRetry?: boolean
  onRetry?: () => void
  background?: string
  textColor?: string
  mutedColor?: string
  borderColor?: string
  accentColor?: string
  digest?: string
}

export default function ErrorState({
  title,
  message,
  showRetry = false,
  onRetry,
  background = 'transparent',
  textColor = 'var(--text)',
  mutedColor = 'var(--text-dim)',
  borderColor = 'var(--border)',
  accentColor = 'var(--accent-e)',
  digest,
}: Props) {
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
      background,
      color: textColor,
    }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <h2 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 24,
        fontWeight: 700,
        color: textColor,
        margin: 0,
      }}>
        {title}
      </h2>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: mutedColor,
        maxWidth: 460,
        lineHeight: 1.6,
        margin: 0,
      }}>
        {message}
        {digest && (
          <span style={{ display: 'block', marginTop: 8, color: mutedColor }}>
            Error reference: {digest}
          </span>
        )}
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '1px',
              background: 'transparent',
              border: `1px solid ${accentColor}`,
              color: accentColor,
              borderRadius: 5,
              padding: '8px 20px',
              cursor: 'pointer',
            }}
          >
            ↺ TRY AGAIN
          </button>
        )}
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '1px',
            background: 'transparent',
            border: `1px solid ${borderColor}`,
            color: mutedColor,
            borderRadius: 5,
            padding: '8px 20px',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          ← WORLD MAP
        </Link>
      </div>
    </div>
  )
}
