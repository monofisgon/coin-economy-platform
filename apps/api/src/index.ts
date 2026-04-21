import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import { join } from 'path'
import { Server as SocketIOServer } from 'socket.io'
import { env } from './config/env'
import { prisma } from './config/prisma'
import { redis } from './config/redis'
import Redis from 'ioredis'
import { authRoutes } from './modules/auth/auth.routes'
import { businessRoutes } from './modules/business/business.routes'
import { walletRoutes } from './modules/wallet/wallet.routes'
import { catalogRoutes, catalogPublicRoutes, productPurchaseRoutes } from './modules/catalog/catalog.routes'
import { marketplaceRoutes } from './modules/marketplace/marketplace.routes'
import { notificationRoutes, notificationService } from './modules/notification/notification.routes'
import { searchRoutes } from './modules/search/search.routes'
import { followRoutes, feedRoutes, userCountsRoutes } from './modules/follow/follow.routes'
import { supportRoutes } from './modules/support/support.routes'
import { rankingRoutes } from './modules/ranking/ranking.routes'
import { statsRoutes } from './modules/stats/stats.routes'
import { subscribeToStatsInvalidation } from './modules/stats/stats.service'
import { uploadRoutes } from './modules/upload/upload.routes'
import { scheduleWeeklyRankings } from './modules/ranking/ranking.worker'

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
})

// Extend FastifyInstance with authenticate decorator
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>
  }
}

async function bootstrap() {
  // Register plugins
  await app.register(cors, {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://www.krowdco.com', 'https://krowdco.com'],
    credentials: true,
    optionsSuccessStatus: 200
  })
  await app.register(jwt, { secret: env.JWT_SECRET })
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }) // 5MB max
  await app.register(staticFiles, {
    root: join(process.cwd(), 'public'),
    prefix: '/',
  })

  // JWT authentication decorator
  app.decorate('authenticate', async (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
    try {
      await req.jwtVerify()
    } catch (err) {
      reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Authentication required' })
    }
  })

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // Register modules
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(businessRoutes, { prefix: '/api/businesses' })
  await app.register(walletRoutes, { prefix: '/api/wallets' })
  await app.register(catalogRoutes, { prefix: '/api' })
  await app.register(catalogPublicRoutes, { prefix: '/api/catalog' })
  await app.register(productPurchaseRoutes, { prefix: '/api/products' })
  await app.register(marketplaceRoutes, { prefix: '/api/marketplace' })
  await app.register(notificationRoutes, { prefix: '/api/notifications' })
  await app.register(searchRoutes, { prefix: '/api/search' })
  await app.register(followRoutes, { prefix: '/api/follows' })
  await app.register(feedRoutes, { prefix: '/api/feed' })
  await app.register(userCountsRoutes, { prefix: '/api/users' })
  await app.register(supportRoutes, { prefix: '/api/support' })
  await app.register(rankingRoutes, { prefix: '/api/rankings' })
  await app.register(statsRoutes, { prefix: '/api/stats' })
  await app.register(uploadRoutes, { prefix: '/api/upload' })

  // Start server
  await app.listen({ port: env.PORT, host: env.HOST })
  app.log.info(`API server running on http://${env.HOST}:${env.PORT}`)

  // ─── Stats pub/sub subscriber ───────────────────────────────────────────────
  // Dedicated Redis connection for subscribing (cannot mix subscribe + commands)
  const statsSubscriberRedis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
    maxRetriesPerRequest: null,
  })
  subscribeToStatsInvalidation(statsSubscriberRedis, redis, {
    debug: (msg) => app.log.debug(msg),
  })

  // ─── Socket.IO setup ────────────────────────────────────────────────────────
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/ws',
  })

  // Inject Socket.IO into NotificationService
  notificationService.setSocketIO(io)

  io.on('connection', (socket) => {
    app.log.debug(`[Socket.IO] Client connected: ${socket.id}`)

    // Client must authenticate and join their user room
    socket.on('authenticate', (data: { userId: string }) => {
      if (data?.userId) {
        socket.join(`user:${data.userId}`)
        app.log.debug(`[Socket.IO] User ${data.userId} joined room`)
      }
    })

    socket.on('disconnect', () => {
      app.log.debug(`[Socket.IO] Client disconnected: ${socket.id}`)
    })
  })

  app.log.info('[Socket.IO] WebSocket server initialized on /ws')

  // ─── BullMQ: Schedule weekly rankings cron ──────────────────────────────────
  try {
    await scheduleWeeklyRankings()
  } catch (err) {
    app.log.warn({ err }, '[Rankings] Failed to schedule weekly rankings cron')
  }
}

// Graceful shutdown
const shutdown = async () => {
  app.log.info('Shutting down...')
  await app.close()
  await prisma.$disconnect()
  redis.disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

bootstrap().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
