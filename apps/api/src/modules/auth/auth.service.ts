import { PrismaClient, User, WalletOwner } from '@prisma/client'
import * as crypto from 'crypto'
import { MAX_FAILED_LOGINS, ACCOUNT_LOCK_DURATION_MINUTES } from '@krowdco/shared'
import type { RegisterDTO, LoginDTO, UpdateProfileDTO } from './auth.schema'

// bcrypt is loaded dynamically to allow testing without native bindings
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt') as typeof import('bcrypt')

const SALT_ROUNDS = 10

export interface AuthToken {
  token: string
  userId: string
}

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async register(data: RegisterDTO): Promise<User> {
    const { email, username, password, name } = data

    // Check uniqueness
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    })

    if (existing) {
      if (existing.email === email) {
        const err = new Error('Email already registered')
        ;(err as NodeJS.ErrnoException).code = 'DUPLICATE_EMAIL'
        throw err
      }
      const err = new Error('Username already taken')
      ;(err as NodeJS.ErrnoException).code = 'DUPLICATE_USERNAME'
      throw err
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // Create user + wallet atomically
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          name: name ?? null,
        },
      })

      await tx.wallet.create({
        data: {
          ownerType: WalletOwner.USER,
          userId: newUser.id,
          coinBalance: 0,
          diamondBalance: 0,
        },
      })

      return newUser
    })

    return user
  }

  async login(credentials: LoginDTO): Promise<{ userId: string }> {
    const { email, password } = credentials

    const user = await this.prisma.user.findUnique({ where: { email } })

    if (!user) {
      const err = new Error('Invalid credentials')
      ;(err as NodeJS.ErrnoException).code = 'INVALID_CREDENTIALS'
      throw err
    }

    // Check if account is locked
    if (user.isLocked && user.lockedUntil) {
      if (user.lockedUntil > new Date()) {
        const err = new Error('Account is temporarily locked')
        ;(err as NodeJS.ErrnoException).code = 'ACCOUNT_LOCKED'
        throw err
      }
      // Lock expired — reset
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isLocked: false, lockedUntil: null, failedLogins: 0 },
      })
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash)

    if (!passwordMatch) {
      const newFailedLogins = user.failedLogins + 1

      if (newFailedLogins >= MAX_FAILED_LOGINS) {
        await this.lockAccount(user.id, ACCOUNT_LOCK_DURATION_MINUTES)
        const err = new Error('Account is temporarily locked due to too many failed attempts')
        ;(err as NodeJS.ErrnoException).code = 'ACCOUNT_LOCKED'
        throw err
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: newFailedLogins },
      })

      const err = new Error('Invalid credentials')
      ;(err as NodeJS.ErrnoException).code = 'INVALID_CREDENTIALS'
      throw err
    }

    // Successful login — reset failed attempts
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, isLocked: false, lockedUntil: null },
    })

    return { userId: user.id }
  }

  async lockAccount(userId: string, durationMinutes: number): Promise<void> {
    const lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: true,
        lockedUntil,
        failedLogins: MAX_FAILED_LOGINS,
      },
    })
  }

  async verifyEmail(token: string): Promise<void> {
    // Token format: base64(userId:hash)
    let userId: string
    let providedHash: string

    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8')
      const parts = decoded.split(':')
      if (parts.length < 2) throw new Error('Invalid token format')
      userId = parts[0]
      providedHash = parts.slice(1).join(':')
    } catch {
      const err = new Error('Invalid or expired verification token')
      ;(err as NodeJS.ErrnoException).code = 'INVALID_TOKEN'
      throw err
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      const err = new Error('Invalid or expired verification token')
      ;(err as NodeJS.ErrnoException).code = 'INVALID_TOKEN'
      throw err
    }

    // Verify the hash matches
    const expectedHash = this.generateEmailVerificationHash(userId, user.email)
    if (providedHash !== expectedHash) {
      const err = new Error('Invalid or expired verification token')
      ;(err as NodeJS.ErrnoException).code = 'INVALID_TOKEN'
      throw err
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    })
  }

  async updateProfile(userId: string, data: UpdateProfileDTO): Promise<User> {
    const { name, username, profilePhoto, socialLinks, newEmail, currentPassword, newPassword } =
      data

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      const err = new Error('User not found')
      ;(err as NodeJS.ErrnoException).code = 'USER_NOT_FOUND'
      throw err
    }

    // Validate username uniqueness if changing
    if (username && username !== user.username) {
      const existing = await this.prisma.user.findUnique({ where: { username } })
      if (existing) {
        const err = new Error('Username already taken')
        ;(err as NodeJS.ErrnoException).code = 'DUPLICATE_USERNAME'
        throw err
      }
    }

    // Password change requires current password
    let passwordHash: string | undefined
    if (newPassword) {
      if (!currentPassword) {
        const err = new Error('Current password is required to set a new password')
        ;(err as NodeJS.ErrnoException).code = 'CURRENT_PASSWORD_REQUIRED'
        throw err
      }
      const match = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!match) {
        const err = new Error('Current password is incorrect')
        ;(err as NodeJS.ErrnoException).code = 'INVALID_CREDENTIALS'
        throw err
      }
      passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    }

    // Email change: mark as unverified and send verification (token generation only here)
    let emailUpdate: { email?: string; emailVerified?: boolean } = {}
    if (newEmail && newEmail !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email: newEmail } })
      if (existingEmail) {
        const err = new Error('Email already registered')
        ;(err as NodeJS.ErrnoException).code = 'DUPLICATE_EMAIL'
        throw err
      }
      // Email is updated but marked as unverified until confirmed
      emailUpdate = { email: newEmail, emailVerified: false }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(username !== undefined && { username }),
        ...(profilePhoto !== undefined && { profilePhoto }),
        ...(socialLinks !== undefined && { socialLinks }),
        ...(passwordHash !== undefined && { passwordHash }),
        ...emailUpdate,
      },
    })

    return updated
  }

  generateEmailVerificationToken(userId: string, email: string): string {
    const hash = this.generateEmailVerificationHash(userId, email)
    return Buffer.from(`${userId}:${hash}`).toString('base64')
  }

  private generateEmailVerificationHash(userId: string, email: string): string {
    return crypto
      .createHmac('sha256', 'email-verification-secret')
      .update(`${userId}:${email}`)
      .digest('hex')
  }
}
