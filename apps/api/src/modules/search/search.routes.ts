import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { SearchService } from './search.service'
import { prisma } from '../../config/prisma'

const searchService = new SearchService(prisma)

export async function searchRoutes(app: FastifyInstance) {
  /**
   * GET /api/search/businesses?q=<query>
   * Search businesses by name or category. Only ACTIVE businesses. No financial data.
   * Requirements: 14.1, 14.3, 14.7, 14.8
   */
  app.get(
    '/businesses',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = (req.query as { q?: string }).q ?? ''
      const results = await searchService.searchBusinesses(q)

      if (results.length === 0) {
        return reply.status(200).send({
          businesses: [],
          message: 'No se encontraron negocios que coincidan con la búsqueda.',
        })
      }

      return reply.status(200).send({ businesses: results })
    },
  )

  /**
   * GET /api/search/users?q=<query>
   * Search users by username. No financial data.
   * Requirements: 14.3, 14.4, 1.9
   */
  app.get(
    '/users',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = (req.query as { q?: string }).q ?? ''
      const results = await searchService.searchUsers(q)

      if (results.length === 0) {
        return reply.status(200).send({
          users: [],
          message: 'No se encontraron usuarios que coincidan con la búsqueda.',
        })
      }

      return reply.status(200).send({ users: results })
    },
  )
}
