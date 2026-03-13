import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hibou — ESG Country Intelligence Explorer',
    short_name: 'Hibou',
    description:
      'ESG country intelligence with percentile-based scores across environmental, social, and governance pillars.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0a08',
    theme_color: '#0d0a08',
    icons: [
      {
        src: '/icon.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
