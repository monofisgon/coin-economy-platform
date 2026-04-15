import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { FollowService } from './follow.service'
import { prisma } from '../../config/prisma'

const followService = new FollowService(prisma)

const ERROR_STATUS: Record<string, number> = {
  FOLLOW_ALREADY_EXISTS: 409,
  FOLLOW_NOT_FOUND: 404,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
}

function handleError(reply: FastifyReply, err: unknown) {
  const error = err as NodeJS.ErrnoException
  const code = error.code ?? 'INTERNAL_ERROR'
  const status = ERROR_STATUS[code] ?? 500
  return reply.status(status).send({ code, message: error.message })
}

export async function followRoutes(app: FastifyInstance) {
  /**
   * POST /api/follows
   * Follow a user or business.
   * Requirements: 18.1, 18.3, 18.7
   */
  app.post(
    '/',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const followerId = (req.user as { sub: string }).sub
      const body = req.body as { followedUserId?: string; followedBizId?: string } | undefined
      try {
        const follow = await followService.createFollow(followerId, body ?? {})
        return reply.status(201).send({ follow })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * DELETE /api/follows/:id
   * Unfollow.
   * Requirements: 18.2, 18.8
   */
  app.delete(
    '/:id',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const followerId = (req.user as { sub: string }).sub
      const { id } = req.params as { id: string }
      try {
        await followService.deleteFollow(followerId, id)
        return reply.status(204).send()
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}

export async function feedRoutes(app: FastifyInstance) {
  /**
   * GET /api/feed
   */
  app.get(
    '/',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = (req.user as { sub: string }).sub
      try {
        const result = await followService.getFeed(userId)
        return reply.status(200).send(result)
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}

export async function userCountsRoutes(app: FastifyInstance) {
  /**
   * GET /api/users/:userId/counts
   * Returns follower and following counts for a user by ID or username.
   */
  app.get(
    '/:userId/counts',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req.params as { userId: string }
      try {
        // Try by ID first, then by username
        let resolvedId = userId
        const isUUID = /^[0-9a-f-]{36}$/i.test(userId)
        if (!isUUID) {
          const user = await prisma.user.findUnique({ where: { username: userId }, select: { id: true } })
          if (!user) return reply.status(404).send({ code: 'USER_NOT_FOUND', message: 'User not found' })
          resolvedId = user.id
        }
        const counts = await followService.getUserCounts(resolvedId)
        return reply.status(200).send(counts)
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}
