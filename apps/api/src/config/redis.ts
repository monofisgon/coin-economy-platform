import Redis from 'ioredis'
import { env } from './env'

const redisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
  maxRetriesPerRequest: null, // required by BullMQ
}

// Shared Redis client for general use (cache, pub/sub)
export const redis = new Redis(redisOptions)

// Dedicated Redis connection for BullMQ (requires maxRetriesPerRequest: null)
export const bullRedisConnection = new Redis(redisOptions)

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err)
})

redis.on('connect', () => {
  console.log('[Redis] Connected')
})
