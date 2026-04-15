import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { BusinessService } from './business.service'
import {
  createBusinessSchema,
  updateBusinessSchema,
  type CreateBusinessDTO,
  type UpdateBusinessDTO,
} from './business.schema'
import { prisma } from '../../config/prisma'

const businessService = new BusinessService(prisma)

const ERROR_STATUS: Record<string, number> = {
  BUSINESS_LIMIT_REACHED: 422,
  BUSINESS_NOT_FOUND: 404,
  FORBIDDEN: 403,
}

function handleError(reply: FastifyReply, err: unknown) {
  const error = err as NodeJS.ErrnoException
  const code = error.code ?? 'INTERNAL_ERROR'
  const status = ERROR_STATUS[code] ?? 500
  return reply.status(status).send({ code, message: error.message })
}

export async function businessRoutes(app: FastifyInstance) {
  /**
   * POST /api/businesses
   * Create a new business (authenticated user, max 3 per user)
   * Requirements: 2.1, 2.2, 2.6, 2.7, 2.8, 2.9, 2.11
   */
  app.post(
    '/',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = createBusinessSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const ownerId = (req.user as { sub: string }).sub

      try {
        const business = await businessService.create(ownerId, parsed.data as CreateBusinessDTO)
        return reply.status(201).send({ business })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * PATCH /api/businesses/:id
   * Update a business (only the owner)
   * Requirements: 2.3, 2.4, 2.5
   */
  app.patch(
    '/:id',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const parsed = updateBusinessSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const ownerId = (req.user as { sub: string }).sub
      const { id } = req.params

      try {
        const business = await businessService.update(id, ownerId, parsed.data as UpdateBusinessDTO)
        return reply.status(200).send({ business })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * GET /api/businesses/:id
   * Public business profile with active products
   * Requirements: 2.5, 7.8
   */
  app.get(
    '/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = req.params

      try {
        const profile = await businessService.getProfile(id)
        return reply.status(200).send({ business: profile })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * GET /api/businesses
   * List businesses owned by the authenticated user
   * Requirements: 2.6
   */
  app.get(
    '/',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ownerId = (req.user as { sub: string }).sub

      try {
        const businesses = await businessService.listByOwner(ownerId)
        return reply.status(200).send({ businesses })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}
