import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CatalogService } from './catalog.service'
import {
  createProductSchema,
  updateProductSchema,
  catalogQuerySchema,
  type CreateProductDTO,
  type UpdateProductDTO,
} from './catalog.schema'
import { prisma } from '../../config/prisma'

const catalogService = new CatalogService(prisma)

const ERROR_STATUS: Record<string, number> = {
  BUSINESS_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_PRODUCT_PRICE: 400,
  PRODUCT_INACTIVE: 422,
  INSUFFICIENT_BALANCE: 422,
  WALLET_NOT_FOUND: 404,
}

function handleError(reply: FastifyReply, err: unknown) {
  const error = err as NodeJS.ErrnoException
  const code = error.code ?? 'INTERNAL_ERROR'
  const status = ERROR_STATUS[code] ?? 500
  return reply.status(status).send({ code, message: error.message })
}

export async function catalogRoutes(app: FastifyInstance) {
  /**
   * POST /api/businesses/:id/products
   * Create a product for a business (Business_Owner only)
   * Requirements: 7.1, 7.9
   */
  app.post(
    '/businesses/:id/products',
    { onRequest: [app.authenticate] },
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const parsed = createProductSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const requesterId = (req.user as { sub: string }).sub
      const { id: businessId } = req.params

      try {
        const product = await catalogService.createProduct(
          businessId,
          requesterId,
          parsed.data as CreateProductDTO,
        )
        return reply.status(201).send({ product })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * PATCH /api/businesses/:id/products/:productId
   * Update a product (Business_Owner only)
   * Requirements: 7.2, 7.9
   */
  app.patch(
    '/businesses/:id/products/:productId',
    { onRequest: [app.authenticate] },
    async (
      req: FastifyRequest<{ Params: { id: string; productId: string } }>,
      reply: FastifyReply,
    ) => {
      const parsed = updateProductSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const requesterId = (req.user as { sub: string }).sub
      const { id: businessId, productId } = req.params

      try {
        const product = await catalogService.updateProduct(
          businessId,
          productId,
          requesterId,
          parsed.data as UpdateProductDTO,
        )
        return reply.status(200).send({ product })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * DELETE /api/businesses/:id/products/:productId
   * Soft-delete a product (isActive=false, Business_Owner only)
   * Requirements: 7.3
   */
  app.delete(
    '/businesses/:id/products/:productId',
    { onRequest: [app.authenticate] },
    async (
      req: FastifyRequest<{ Params: { id: string; productId: string } }>,
      reply: FastifyReply,
    ) => {
      const requesterId = (req.user as { sub: string }).sub
      const { id: businessId, productId } = req.params

      try {
        const product = await catalogService.deactivateProduct(businessId, productId, requesterId)
        return reply.status(200).send({ product })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}

export async function catalogPublicRoutes(app: FastifyInstance) {
  /**
   * GET /api/catalog?location=<city>
   * Get active products from active businesses filtered by location
   * Requirements: 7.4, 7.5, 7.6, 7.7, 7.8
   */
  app.get(
    '/',
    { onRequest: [app.authenticate] },
    async (
      req: FastifyRequest<{ Querystring: Record<string, string> }>,
      reply: FastifyReply,
    ) => {
      const parsed = catalogQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'location query parameter is required',
          details: parsed.error.flatten(),
        })
      }

      try {
        const products = await catalogService.getCatalogByLocation(parsed.data.location)
        return reply.status(200).send({ products })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}

export async function productPurchaseRoutes(app: FastifyInstance) {
  /**
   * POST /api/products/:id/purchase
   * Purchase a product with Coins
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   */
  app.post(
    '/:id/purchase',
    { onRequest: [app.authenticate] },
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const buyerUserId = (req.user as { sub: string }).sub
      const { id: productId } = req.params

      try {
        const transaction = await catalogService.purchaseProduct(productId, buyerUserId)
        return reply.status(201).send({ transaction })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}
