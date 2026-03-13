import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, '1 m'),
      analytics: true,
      prefix: 'hibou:ratelimit',
    })
  : null

export type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  if (!ratelimit) {
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }

  const result = await ratelimit.limit(identifier)
  const resetMs = typeof result.reset === 'number'
    ? result.reset
    : result.reset.getTime()

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: resetMs,
  }
}

export const rateLimitEnabled = Boolean(ratelimit)
