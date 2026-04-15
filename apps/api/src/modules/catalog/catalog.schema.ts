import { z } from 'zod'

// ─── Product CRUD schemas ─────────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  imageUrl: z.string().url().optional(),
  coinPrice: z.number().positive({ message: 'coinPrice must be greater than 0' }),
})

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
  imageUrl: z.string().url().optional().nullable(),
  coinPrice: z.number().positive({ message: 'coinPrice must be greater than 0' }).optional(),
})

// ─── Catalog query schema ─────────────────────────────────────────────────────

export const catalogQuerySchema = z.object({
  location: z.string().min(1).max(255),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateProductDTO = z.infer<typeof createProductSchema>
export type UpdateProductDTO = z.infer<typeof updateProductSchema>
export type CatalogQueryDTO = z.infer<typeof catalogQuerySchema>
