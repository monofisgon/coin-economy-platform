import { z } from 'zod'
import { TransactionType } from '@prisma/client'

export const rechargeCoinsSchema = z.object({
  businessWalletId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
})

export const rechargeDiamondsSchema = z.object({
  targetWalletId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
})

export const donateSchema = z.object({
  fromBusinessWalletId: z.string().uuid(),
  toUserWalletId: z.string().uuid(),
  amount: z.number().positive(),
})

export const refundDiamondsSchema = z.object({
  userWalletId: z.string().uuid(),
})

export const transactionHistoryQuerySchema = z.object({
  type: z.nativeEnum(TransactionType).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type RechargeCoinsDTO = z.infer<typeof rechargeCoinsSchema>
export type RechargeDiamondsDTO = z.infer<typeof rechargeDiamondsSchema>
export type DonateDTO = z.infer<typeof donateSchema>
export type RefundDiamondsDTO = z.infer<typeof refundDiamondsSchema>
export type TransactionHistoryQueryDTO = z.infer<typeof transactionHistoryQuerySchema>
