// app/not-found.tsx
// Custom 404 page : shown when getSummaryByIso2 returns null
// (invalid ISO2 code in the URL) or any notFound() call.

export default function NotFound() {
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
      <div style={{ fontSize: 48 }}>🌍</div>
      <h2 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--text)',
        margin: 0,
      }}>
        Country not found
      </h2>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--text-dim)',
        maxWidth: 400,
        lineHeight: 1.6,
        margin: 0,
      }}>
        That ISO2 code does not match any country in the Hibou dataset.
        Check the URL or return to the world map.
      </p>
      <a
        href="/"
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
          textDecoration: 'none',
          marginTop: 8,
        }}
      >
        ← WORLD MAP
      </a>
    </div>
  )
}
