// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import ThemeToggle from '@/components/ui/ThemeToggle'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

const siteTitle = 'Hibou — Auditable ESG Scores'
const siteDescription =
  'Percentile‑based ESG scores for sovereign countries, with carry‑forward data and visible gaps.'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: siteTitle,
    template: '%s — Hibou',
  },
  description: siteDescription,
  applicationName: 'Hibou',
  keywords: [
    'ESG',
    'sustainability',
    'climate',
    'governance',
    'social indicators',
    'country rankings',
    'data visualization',
  ],
  authors: [{ name: 'Hibou' }],
  creator: 'Hibou',
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: '/',
    siteName: 'Hibou',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Hibou — Auditable ESG Scores',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: ['/twitter-image'],
  },
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f3ef' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0a08' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&display=swap"
        />
      </head>
      <body>
        <nav className="nav">
          <a href="/" className="nav-logo">🦉 <span>Hibou</span></a>
          <div className="nav-links">
            <a href="/"          className="nav-link">🌍 Map</a>
            <a href="/rankings"  className="nav-link">🏆 Rankings</a>
            <a href="/compare"   className="nav-link">⚖️ Compare</a>
          </div>
          <div className="nav-right">
            <span className="nav-meta">Percentile ESG · Global/Peer</span>
            <ThemeToggle />
          </div>
        </nav>
        <main className="main-content">{children}</main>
      </body>
    </html>
  )
}
