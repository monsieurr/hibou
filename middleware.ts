import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, rateLimitEnabled } from '@/lib/ratelimit'

export async function middleware(request: NextRequest) {
  if (!rateLimitEnabled) {
    return NextResponse.next()
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip =
    forwardedFor?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-vercel-forwarded-for') ||
    'anonymous'

  const result = await checkRateLimit(ip)
  if (result.success) {
    return NextResponse.next()
  }

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Hibou — Slow down</title>
      <style>
        :root { color-scheme: dark; }
        body {
          margin: 0;
          font-family: "Inter", system-ui, -apple-system, sans-serif;
          background: #0d0a08;
          color: #f6efe7;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .card {
          max-width: 520px;
          padding: 32px;
          border-radius: 12px;
          border: 1px solid #2b241f;
          background: #14100d;
          text-align: center;
        }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #e6c84f;
          border: 1px solid #3b322b;
          margin-bottom: 12px;
          font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace;
        }
        h1 { font-size: 20px; margin: 0 0 8px; }
        p { margin: 0; color: #d8cfc6; line-height: 1.6; font-size: 14px; }
        .timer { margin-top: 14px; font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">Rate limit</div>
        <h1>Too many requests</h1>
        <p>We’re pacing traffic to keep Hibou reliable. Please wait a moment, then try again.</p>
        <div class="timer">Retry in ~${retryAfter}s</div>
      </div>
    </body>
  </html>`
  const response = new NextResponse(html, {
    status: 429,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
  response.headers.set('Retry-After', String(retryAfter))
  response.headers.set('X-RateLimit-Limit', String(result.limit))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
