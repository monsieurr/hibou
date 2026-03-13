import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, rateLimitEnabled } from '@/lib/ratelimit'

export async function middleware(request: NextRequest) {
  if (!rateLimitEnabled) {
    return NextResponse.next()
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() || request.ip || 'anonymous'

  const result = await checkRateLimit(ip)
  if (result.success) {
    return NextResponse.next()
  }

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
  const response = new NextResponse('Too many requests, please slow down.', {
    status: 429,
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
