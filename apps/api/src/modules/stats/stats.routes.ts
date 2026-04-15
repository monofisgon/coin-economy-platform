import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'
import { StatsService } from './stats.service'

const statsService = new StatsService(prisma, redis)

export { statsService }

export async function statsRoutes(app: FastifyInstance) {
  /**
   * GET /api/stats
   * Returns platform statistics: total users, total active businesses, total IncentiveFund coins.
   * Uses Redis cache with TTL of 5 seconds; invalidated via pub/sub on relevant changes.
   * Requirements: 17.1, 17.5
   */
  app.get('/', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await statsService.getStats()
      return reply.status(200).send(stats)
    } catch (err) {
      const error = err as NodeJS.ErrnoException
      return reply
        .status(500)
        .send({ code: error.code ?? 'INTERNAL_ERROR', message: error.message })
    }
  })
}
