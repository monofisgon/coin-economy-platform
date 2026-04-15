import type { Redis } from 'ioredis'
import type { PrismaClient } from '@prisma/client'
import { BusinessStatus } from '@prisma/client'

export const STATS_CACHE_KEY = 'platform:stats'
export const STATS_CHANNEL = 'stats:invalidate'
const STATS_TTL_SECONDS = 5

export interface PlatformStats {
  totalUsers: number
  totalActiveBusinesses: number
  incentiveFundCoins: number
}

export class StatsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  async getStats(): Promise<PlatformStats> {
    // Try cache first
    const cached = await this.redis.get(STATS_CACHE_KEY)
    if (cached) {
      return JSON.parse(cached) as PlatformStats
    }

    return this.fetchAndCache()
  }

  async fetchAndCache(): Promise<PlatformStats> {
    const [totalUsers, totalActiveBusinesses, incentiveFund] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.business.count({ where: { status: BusinessStatus.ACTIVE } }),
      this.prisma.incentiveFund.findFirst({ select: { coinBalance: true } }),
    ])

    const stats: PlatformStats = {
      totalUsers,
      totalActiveBusinesses,
      incentiveFundCoins: incentiveFund ? Number(incentiveFund.coinBalance) : 0,
    }

    await this.redis.setex(STATS_CACHE_KEY, STATS_TTL_SECONDS, JSON.stringify(stats))
    return stats
  }

  /**
   * Invalidate the stats cache by deleting the key.
   * The next GET /api/stats request will recompute from Prisma.
   */
  async invalidateCache(): Promise<void> {
    await this.redis.del(STATS_CACHE_KEY)
  }

  /**
   * Publish an invalidation event to the Redis pub/sub channel.
   * Any subscriber will delete the cache key within milliseconds.
   */
  async publishInvalidation(publisherRedis: Redis): Promise<void> {
    await publisherRedis.publish(STATS_CHANNEL, 'invalidate')
  }
}

/**
 * Subscribe to the stats invalidation channel using a dedicated Redis connection.
 * When a message arrives, the cache key is deleted so the next request recomputes.
 */
export function subscribeToStatsInvalidation(
  subscriberRedis: Redis,
  cacheRedis: Redis,
  logger?: { debug: (msg: string) => void },
): void {
  subscriberRedis.subscribe(STATS_CHANNEL, (err) => {
    if (err) {
      console.error('[Stats] Failed to subscribe to stats:invalidate channel:', err)
    } else {
      logger?.debug('[Stats] Subscribed to stats:invalidate channel')
    }
  })

  subscriberRedis.on('message', (channel: string, _message: string) => {
    if (channel === STATS_CHANNEL) {
      cacheRedis.del(STATS_CACHE_KEY).catch((e) => {
        console.error('[Stats] Failed to invalidate stats cache:', e)
      })
      logger?.debug('[Stats] Cache invalidated via pub/sub')
    }
  })
}
