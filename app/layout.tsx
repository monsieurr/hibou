// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import ThemeToggle from '@/components/ui/ThemeToggle'

export const metadata: Metadata = {
  title: 'Hibou — ESG Country Intelligence Explorer',
  description:
    'Aggregates, normalises, and visualises Environmental, Social, and Governance (ESG) data from authoritative open sources across all sovereign nations.',
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
            <span className="nav-meta">27 Indicators · ESG 2026</span>
            <ThemeToggle />
          </div>
        </nav>
        <main className="main-content">{children}</main>
      </body>
    </html>
  )
}
