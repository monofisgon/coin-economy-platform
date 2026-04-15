import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { SupportService } from './support.service'
import { TicketStatus } from '@prisma/client'
import { prisma } from '../../config/prisma'

const supportService = new SupportService(prisma)

const ERROR_STATUS: Record<string, number> = {
  TICKET_NOT_FOUND: 404,
  CHAT_NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_TICKET_TRANSITION: 422,
  INVALID_RATING: 400,
  TICKET_NOT_CLOSED: 422,
  VALIDATION_ERROR: 400,
}

function handleError(reply: FastifyReply, err: unknown) {
  const error = err as NodeJS.ErrnoException
  const code = error.code ?? 'INTERNAL_ERROR'
  const status = ERROR_STATUS[code] ?? 500
  return reply.status(status).send({ code, message: error.message })
}

export async function supportRoutes(app: FastifyInstance) {
  /**
   * POST /api/support/query
   * Search FAQ knowledge base.
   * Requirements: 13.1, 13.2
   */
  app.post(
    '/query',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { question?: string } | undefined
      const question = body?.question ?? ''
      const result = supportService.queryFAQ(question)

      if (result) {
        return reply.status(200).send({ found: true, ...result })
      }

      return reply.status(200).send({
        found: false,
        message: 'No encontramos una respuesta en nuestra base de conocimiento.',
        escalationOptions: [
          { type: 'TICKET', label: 'Crear un ticket de soporte' },
          { type: 'CHAT', label: 'Iniciar chat con un agente' },
        ],
      })
    },
  )

  /**
   * POST /api/support/tickets
   * Create a support ticket.
   * Requirements: 13.3
   */
  app.post(
    '/tickets',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const requesterId = (req.user as { sub: string }).sub
      const body = req.body as { description?: string } | undefined
      try {
        const ticket = await supportService.createTicket(requesterId, body?.description ?? '')
        return reply.status(201).send({ ticket })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * PATCH /api/support/tickets/:id/status
   * Update ticket status (Support_Agent only).
   * Requirements: 13.4, 13.5, 13.8
   */
  app.patch(
    '/tickets/:id/status',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const agentId = (req.user as { sub: string }).sub
      const { id } = req.params as { id: string }
      const body = req.body as { status?: string } | undefined
      const newStatus = body?.status as TicketStatus | undefined

      if (!newStatus || !Object.values(TicketStatus).includes(newStatus)) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: `status must be one of: ${Object.values(TicketStatus).join(', ')}`,
        })
      }

      try {
        const ticket = await supportService.updateTicketStatus(agentId, id, newStatus)
        return reply.status(200).send({ ticket })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * POST /api/support/tickets/:id/rating
   * Rate a closed ticket.
   * Requirements: 13.9
   */
  app.post(
    '/tickets/:id/rating',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = (req.user as { sub: string }).sub
      const { id } = req.params as { id: string }
      const body = req.body as { rating?: number } | undefined
      const rating = body?.rating

      if (rating === undefined) {
        return reply.status(400).send({ code: 'VALIDATION_ERROR', message: 'rating is required' })
      }

      try {
        const ticket = await supportService.rateTicket(userId, id, rating)
        return reply.status(200).send({ ticket })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * POST /api/support/chat
   * Initiate a support chat (MVP: always creates a ticket).
   * Requirements: 13.6, 13.7
   */
  app.post(
    '/chat',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const requesterId = (req.user as { sub: string }).sub
      const body = req.body as { context?: string } | undefined
      try {
        const result = await supportService.initiateChat(requesterId, body?.context ?? '')
        return reply.status(201).send({
          message: 'No hay agentes disponibles en este momento. Se ha creado un ticket de soporte.',
          ticket: result.ticket,
          chatId: result.chatId,
        })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * POST /api/support/chats/:id/rating
   * Rate a support chat.
   * Requirements: 13.10
   */
  app.post(
    '/chats/:id/rating',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = (req.user as { sub: string }).sub
      const { id } = req.params as { id: string }
      const body = req.body as { rating?: number } | undefined
      const rating = body?.rating

      if (rating === undefined) {
        return reply.status(400).send({ code: 'VALIDATION_ERROR', message: 'rating is required' })
      }

      try {
        const chat = await supportService.rateChat(userId, id, rating)
        return reply.status(200).send({ chat })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}
