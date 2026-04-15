import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './auth.service'
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  updateProfileSchema,
  type RegisterDTO,
  type LoginDTO,
  type VerifyEmailDTO,
  type UpdateProfileDTO,
} from './auth.schema'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'
import { env } from '../../config/env'
import { STATS_CHANNEL } from '../stats/stats.service'

const authService = new AuthService(prisma)

// Error code → HTTP status mapping
const ERROR_STATUS: Record<string, number> = {
  DUPLICATE_EMAIL: 409,
  DUPLICATE_USERNAME: 409,
  ACCOUNT_LOCKED: 423,
  INVALID_CREDENTIALS: 401,
  INVALID_TOKEN: 400,
  USER_NOT_FOUND: 404,
  DUPLICATE_USERNAME_UPDATE: 409,
  CURRENT_PASSWORD_REQUIRED: 400,
}

function handleError(reply: FastifyReply, err: unknown) {
  const error = err as NodeJS.ErrnoException
  const code = error.code ?? 'INTERNAL_ERROR'
  const status = ERROR_STATUS[code] ?? 500
  return reply.status(status).send({ code, message: error.message })
}

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /api/auth/register
   * Requirements: 1.1, 1.2, 1.3
   */
  app.post('/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.flatten(),
      })
    }

    try {
      const user = await authService.register(parsed.data as RegisterDTO)
      const token = app.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: env.JWT_EXPIRES_IN })

      // Invalidate stats cache: total users changed
      redis.publish(STATS_CHANNEL, 'invalidate').catch(() => {})

      return reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        },
        token,
      })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  /**
   * POST /api/auth/login
   * Requirements: 1.4, 1.5
   */
  app.post('/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.flatten(),
      })
    }

    try {
      const { userId } = await authService.login(parsed.data as LoginDTO)

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
      const token = app.jwt.sign({ sub: userId, role: user.role }, { expiresIn: env.JWT_EXPIRES_IN })

      return reply.status(200).send({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        token,
      })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  /**
   * POST /api/auth/verify-email
   * Requirements: 1.7
   */
  app.post('/verify-email', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = verifyEmailSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.flatten(),
      })
    }

    try {
      await authService.verifyEmail((parsed.data as VerifyEmailDTO).token)
      return reply.status(200).send({ message: 'Email verified successfully' })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  /**
   * PATCH /api/auth/profile
   * Requirements: 1.6, 1.7
   * Requires authentication
   */
  app.patch(
    '/profile',
    {
      onRequest: [app.authenticate],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = updateProfileSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const userId = (req.user as { sub: string }).sub

      try {
        const updated = await authService.updateProfile(userId, parsed.data as UpdateProfileDTO)
        return reply.status(200).send({
          user: {
            id: updated.id,
            email: updated.email,
            username: updated.username,
            name: updated.name,
            profilePhoto: updated.profilePhoto,
            socialLinks: updated.socialLinks,
            role: updated.role,
            emailVerified: updated.emailVerified,
            updatedAt: updated.updatedAt,
          },
        })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}
