import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { RankingService, type RankingType } from './ranking.service'
import { prisma } from '../../config/prisma'

const rankingService = new RankingService(prisma)

export { rankingService }

const VALID_RANKING_TYPES: RankingType[] = [
  'USER_COINS_SOLD',
  'USER_COINS_BALANCE',
  'USER_COINS_REDEEMED',
  'BUSINESS_COINS_DONATED',
  'BUSINESS_COINS_PURCHASED',
  'BUSINESS_COINS_REDEEMED_ON',
]

export async function rankingRoutes(app: FastifyInstance) {
  /**
   * GET /api/rankings?type=<type>&year=<year>
   * Returns rankings if >= 500 active businesses, otherwise empty with message.
   * Requirements: 15.1, 15.2, 15.3, 15.6, 15.7
   */
  app.get(
    '/',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = req.query as { type?: string; year?: string }
      const type = query.type as RankingType | undefined
      const year = query.year ? parseInt(query.year, 10) : undefined

      if (!type || !VALID_RANKING_TYPES.includes(type)) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: `type must be one of: ${VALID_RANKING_TYPES.join(', ')}`,
        })
      }

      try {
        const ranking = await rankingService.getRankings(type, year)
        return reply.status(200).send({ ranking })
      } catch (err) {
        const error = err as NodeJS.ErrnoException
        return reply.status(500).send({ code: error.code ?? 'INTERNAL_ERROR', message: error.message })
      }
    },
  )
}
