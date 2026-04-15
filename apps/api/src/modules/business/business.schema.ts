import { z } from 'zod'

const socialLinksSchema = z
  .object({
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    tiktok: z.string().optional(),
    whatsapp: z.string().optional(),
    website: z.string().optional(),
  })
  .optional()

export const createBusinessSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  category: z.string().min(1).max(100),
  address: z.string().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  profilePhoto: z.string().url().optional(),
  coverPhoto: z.string().url().optional(),
  socialLinks: socialLinksSchema,
})

export const updateBusinessSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(1000).optional(),
  category: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  profilePhoto: z.string().url().optional(),
  coverPhoto: z.string().url().optional(),
  socialLinks: socialLinksSchema,
})

export type CreateBusinessDTO = z.infer<typeof createBusinessSchema>
export type UpdateBusinessDTO = z.infer<typeof updateBusinessSchema>
