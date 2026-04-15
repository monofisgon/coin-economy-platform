import { z } from 'zod'

export const createOfferSchema = z.object({
  coinAmount: z.number().positive({ message: 'coinAmount must be greater than 0' }),
  diamondPricePerCoin: z.number().positive({ message: 'diamondPricePerCoin must be greater than 0' }),
  visibility: z.enum(['PUBLICA', 'PRIVADA']),
})

export const listOffersQuerySchema = z.object({
  coinAmountMin: z.coerce.number().positive().optional(),
  coinAmountMax: z.coerce.number().positive().optional(),
  diamondPriceMin: z.coerce.number().positive().optional(),
  diamondPriceMax: z.coerce.number().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const acceptOfferSchema = z.object({
  accessCode: z.string().optional(),
})

export type CreateOfferDTO = z.infer<typeof createOfferSchema>
export type ListOffersQueryDTO = z.infer<typeof listOffersQuerySchema>
export type AcceptOfferDTO = z.infer<typeof acceptOfferSchema>
