import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { MarketplaceService } from './marketplace.service'
import {
  createOfferSchema,
  listOffersQuerySchema,
  acceptOfferSchema,
  type CreateOfferDTO,
  type AcceptOfferDTO,
} from './marketplace.schema'
import { prisma } from '../../config/prisma'

const marketplaceService = new MarketplaceService(prisma)

const ERROR_STATUS: Record<string, number> = {
  WALLET_NOT_FOUND: 404,
  OFFER_NOT_FOUND: 404,
  OFFER_CREATION_FORBIDDEN: 403,
  FORBIDDEN: 403,
  INSUFFICIENT_BALANCE: 422,
  OFFER_NOT_ACTIVE: 422,
  INVALID_ACCESS_CODE: 403,
  NO_ACCESS_CODE: 404,
}

function handleError(reply: FastifyReply, err: unknown) {
  const error = err as NodeJS.ErrnoException
  const code = error.code ?? 'INTERNAL_ERROR'
  const status = ERROR_STATUS[code] ?? 500
  return reply.status(status).send({ code, message: error.message })
}

export async function marketplaceRoutes(app: FastifyInstance) {
  /**
   * POST /api/marketplace/offers
   * Create a Marketplace Offer (Users only, not Business_Owners)
   * Requirements: 9.1, 9.2, 9.3, 9.13, 9.14
   */
  app.post(
    '/offers',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = createOfferSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const userId = (req.user as { sub: string }).sub

      try {
        const offer = await marketplaceService.createOffer(userId, parsed.data as CreateOfferDTO)
        return reply.status(201).send({ offer })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * GET /api/marketplace/offers
   * List active Offers ordered by diamondPricePerCoin ASC, filterable
   * Requirements: 9.4, 9.12, 9.15
   */
  app.get(
    '/offers',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest<{ Querystring: Record<string, string> }>, reply: FastifyReply) => {
      const parsed = listOffersQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: parsed.error.flatten(),
        })
      }

      const requesterId = (req.user as { sub: string }).sub

      try {
        const result = await marketplaceService.listOffers(parsed.data, requesterId)
        return reply.status(200).send(result)
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * GET /api/marketplace/offers/:id/access-code
   * Get the access code of a private Offer (seller only)
   * Requirements: 9.16
   */
  app.get(
    '/offers/:id/access-code',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = (req.user as { sub: string }).sub
      const { id: offerId } = req.params

      try {
        const accessCode = await marketplaceService.getAccessCode(userId, offerId)
        return reply.status(200).send({ accessCode })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * POST /api/marketplace/offers/:id/accept
   * Accept an Offer as a buyer (User or Business_Owner)
   * Requirements: 9.5, 9.6, 9.7, 9.8, 9.9, 9.17, 9.18
   */
  app.post(
    '/offers/:id/accept',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const parsed = acceptOfferSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const buyerUserId = (req.user as { sub: string }).sub
      const { id: offerId } = req.params
      const { accessCode } = parsed.data as AcceptOfferDTO

      try {
        const result = await marketplaceService.acceptOffer(buyerUserId, offerId, accessCode)
        return reply.status(200).send({ saleTx: result.saleTx, purchaseTx: result.purchaseTx })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * DELETE /api/marketplace/offers/:id
   * Cancel an active Offer (seller only)
   * Requirements: 9.10, 9.11
   */
  app.delete(
    '/offers/:id',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = (req.user as { sub: string }).sub
      const { id: offerId } = req.params

      try {
        await marketplaceService.cancelOffer(userId, offerId)
        return reply.status(200).send({ message: 'Offer cancelled successfully' })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}
