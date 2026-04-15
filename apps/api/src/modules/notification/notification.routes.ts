import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { NotificationService } from './notification.service'
import { prisma } from '../../config/prisma'

const notificationService = new NotificationService(prisma)

export { notificationService }

const ERROR_STATUS: Record<string, number> = {
  NOTIFICATION_NOT_FOUND: 404,
  FORBIDDEN: 403,
}

function handleError(reply: FastifyReply, err: unknown) {
  const error = err as NodeJS.ErrnoException
  const code = error.code ?? 'INTERNAL_ERROR'
  const status = ERROR_STATUS[code] ?? 500
  return reply.status(status).send({ code, message: error.message })
}

export async function notificationRoutes(app: FastifyInstance) {
  /**
   * GET /api/notifications
   * List notifications for the authenticated user, ordered by createdAt DESC.
   * Requirements: 11.4
   */
  app.get(
    '/',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = (req.user as { sub: string }).sub
      try {
        const notifications = await notificationService.listNotifications(userId)
        return reply.status(200).send({ notifications })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * PATCH /api/notifications/:id/read
   * Mark a notification as read.
   * Requirements: 11.5
   */
  app.patch(
    '/:id/read',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = (req.user as { sub: string }).sub
      const { id } = req.params as { id: string }
      try {
        const notification = await notificationService.markAsRead(userId, id)
        return reply.status(200).send({ notification })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}
