import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
  name: z.string().optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
})

export const updateProfileSchema = z.object({
  name: z.string().optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  profilePhoto: z.string().url().optional(),
  socialLinks: z
    .object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      tiktok: z.string().optional(),
      whatsapp: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
  // Email change triggers verification flow
  newEmail: z.string().email().optional(),
  // Password change
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
})

export type RegisterDTO = z.infer<typeof registerSchema>
export type LoginDTO = z.infer<typeof loginSchema>
export type VerifyEmailDTO = z.infer<typeof verifyEmailSchema>
export type UpdateProfileDTO = z.infer<typeof updateProfileSchema>
