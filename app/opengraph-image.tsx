import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          background: '#0d0a08',
          color: '#f6efe7',
          textAlign: 'center',
          padding: '64px',
        }}
      >
        <div style={{ fontSize: 96 }}>🦉</div>
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '0.5px' }}>Hibou</div>
        <div style={{ fontSize: 30, color: '#d8cfc6' }}>
          Auditable ESG scores for countries
        </div>
        <div style={{ fontSize: 22, color: '#b7a99d', maxWidth: 880, lineHeight: 1.4 }}>
          Percentiles, peer groups, and carry‑forward data : with gaps shown, not hidden.
        </div>
      </div>
    ),
    size
  )
}
