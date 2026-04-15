import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { WalletService } from './wallet.service'
import { BusinessService } from '../business/business.service'
import {
  rechargeCoinsSchema,
  rechargeDiamondsSchema,
  donateSchema,
  refundDiamondsSchema,
  transactionHistoryQuerySchema,
  type RechargeCoinsDTO,
  type RechargeDiamondsDTO,
  type DonateDTO,
  type RefundDiamondsDTO,
} from './wallet.schema'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'
import { STATS_CHANNEL } from '../stats/stats.service'

const businessService = new BusinessService(prisma)
const walletService = new WalletService(prisma, businessService)

const ERROR_STATUS: Record<string, number> = {
  WALLET_NOT_FOUND: 404,
  COIN_RECHARGE_FORBIDDEN: 403,
  DIAMOND_REFUND_FORBIDDEN: 403,
  DIAMOND_REFUND_BELOW_MIN: 422,
  DIAMOND_REFUND_ABOVE_MAX: 422,
  DIAMOND_REFUND_RANGE_ERROR: 422,
  INSUFFICIENT_BALANCE: 422,
  SELF_DONATION_NOT_ALLOWED: 422,
  BUSINESS_PENDING: 422,
  PAYMENT_FAILED: 402,
  FORBIDDEN: 403,
  INVALID_AMOUNT: 400,
}

function handleError(reply: FastifyReply, err: unknown) {
  const error = err as NodeJS.ErrnoException
  const code = error.code ?? 'INTERNAL_ERROR'
  const status = ERROR_STATUS[code] ?? 500
  return reply.status(status).send({ code, message: error.message })
}

export async function walletRoutes(app: FastifyInstance) {
  /**
   * GET /api/wallets/:id/balance
   * Get wallet balance
   * Requirements: 5.1, 3.6, 6.8
   */
  app.get(
    '/:id/balance',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = req.params
      try {
        const balance = await walletService.getBalance(id)
        return reply.status(200).send({ balance })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * GET /api/wallets/:id/transactions
   * Get paginated transaction history, filterable by type
   * Requirements: 5.2, 5.4
   */
  app.get(
    '/:id/transactions',
    { onRequest: [app.authenticate] },
    async (
      req: FastifyRequest<{ Params: { id: string }; Querystring: Record<string, string> }>,
      reply: FastifyReply,
    ) => {
      const { id } = req.params
      const parsed = transactionHistoryQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: parsed.error.flatten(),
        })
      }

      const { type, page, limit } = parsed.data

      try {
        const result = await walletService.getTransactionHistory(
          id,
          { type },
          { page, limit },
        )
        return reply.status(200).send(result)
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * POST /api/wallets/recharge/coins
   * Recharge Coins for a Business Wallet (Business_Owner only)
   * Requirements: 3.1-3.8
   */
  app.post(
    '/recharge/coins',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = rechargeCoinsSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const requesterId = (req.user as { sub: string }).sub
      const { businessWalletId, idempotencyKey } = parsed.data as RechargeCoinsDTO

      try {
        const transaction = await walletService.rechargeCoins(
          businessWalletId,
          idempotencyKey,
          requesterId,
        )
        // Invalidate stats cache: active businesses may have changed + IncentiveFund changed
        redis.publish(STATS_CHANNEL, 'invalidate').catch(() => {})
        return reply.status(201).send({ transaction })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * POST /api/wallets/recharge/diamonds
   * Recharge Diamonds for a User or Business Wallet
   * Requirements: 6.1-6.8
   */
  app.post(
    '/recharge/diamonds',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = rechargeDiamondsSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const { targetWalletId, idempotencyKey } = parsed.data as RechargeDiamondsDTO

      try {
        const transaction = await walletService.rechargeDiamonds(targetWalletId, idempotencyKey)
        // Invalidate stats cache: IncentiveFund changed
        redis.publish(STATS_CHANNEL, 'invalidate').catch(() => {})
        return reply.status(201).send({ transaction })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * POST /api/wallets/donate
   * Donate Coins from Business Wallet to User Wallet
   * Requirements: 4.1-4.7
   */
  app.post(
    '/donate',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = donateSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const requesterId = (req.user as { sub: string }).sub
      const { fromBusinessWalletId, toUserWalletId, amount } = parsed.data as DonateDTO

      try {
        const transaction = await walletService.donate(
          fromBusinessWalletId,
          toUserWalletId,
          amount,
          requesterId,
        )
        return reply.status(201).send({ transaction })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  /**
   * POST /api/wallets/refund/diamonds
   * Refund Diamonds back to COP (Users only)
   * Requirements: 12.1-12.7
   */
  app.post(
    '/refund/diamonds',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = refundDiamondsSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const requesterId = (req.user as { sub: string }).sub
      const { userWalletId } = parsed.data as RefundDiamondsDTO

      try {
        const result = await walletService.refundDiamonds(userWalletId, requesterId)
        return reply.status(201).send({ transaction: result, copRefund: result.copRefund })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}
