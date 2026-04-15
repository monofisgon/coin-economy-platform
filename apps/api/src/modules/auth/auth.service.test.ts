import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from './auth.service'
import { MAX_FAILED_LOGINS, ACCOUNT_LOCK_DURATION_MINUTES } from '@coin-economy/shared'

// ─── Minimal Prisma mock ──────────────────────────────────────────────────────

type MockUser = {
  id: string
  email: string
  username: string
  passwordHash: string
  name: string | null
  profilePhoto: string | null
  socialLinks: unknown
  isLocked: boolean
  lockedUntil: Date | null
  failedLogins: number
  emailVerified: boolean
  role: string
  createdAt: Date
  updatedAt: Date
}

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: '',
    name: null,
    profilePhoto: null,
    socialLinks: null,
    isLocked: false,
    lockedUntil: null,
    failedLogins: 0,
    emailVerified: false,
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makePrismaMock() {
  return {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    wallet: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        user: { create: vi.fn() },
        wallet: { create: vi.fn() },
      }
      return fn(tx)
    }),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>
  let service: AuthService

  beforeEach(() => {
    prisma = makePrismaMock()
    service = new AuthService(prisma as unknown as import('@prisma/client').PrismaClient)
  })

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates user and wallet when email and username are unique', async () => {
      prisma.user.findFirst.mockResolvedValue(null)

      const createdUser = makeUser()
      const txMock = {
        user: { create: vi.fn().mockResolvedValue(createdUser) },
        wallet: { create: vi.fn().mockResolvedValue({}) },
      }
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock))

      const result = await service.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      })

      expect(result).toEqual(createdUser)
      expect(txMock.user.create).toHaveBeenCalledOnce()
      expect(txMock.wallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            coinBalance: 0,
            diamondBalance: 0,
            ownerType: 'USER',
          }),
        }),
      )
    })

    it('throws DUPLICATE_EMAIL when email is already registered', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser({ email: 'test@example.com' }))

      await expect(
        service.register({ email: 'test@example.com', username: 'other', password: 'password123' }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_EMAIL' })
    })

    it('throws DUPLICATE_USERNAME when username is already taken', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser({ email: 'other@example.com', username: 'testuser' }))

      await expect(
        service.register({ email: 'new@example.com', username: 'testuser', password: 'password123' }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_USERNAME' })
    })
  })

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns userId on valid credentials', async () => {
      // We need a real bcrypt hash for this test
      const bcrypt = await import('bcrypt')
      const hash = await bcrypt.hash('password123', 10)
      const user = makeUser({ passwordHash: hash })

      prisma.user.findUnique.mockResolvedValue(user)
      prisma.user.update.mockResolvedValue({ ...user, failedLogins: 0 })

      const result = await service.login({ email: 'test@example.com', password: 'password123' })
      expect(result).toEqual({ userId: 'user-1' })
    })

    it('throws INVALID_CREDENTIALS on wrong password', async () => {
      const bcrypt = await import('bcrypt')
      const hash = await bcrypt.hash('correct-password', 10)
      const user = makeUser({ passwordHash: hash })

      prisma.user.findUnique.mockResolvedValue(user)
      prisma.user.update.mockResolvedValue({ ...user, failedLogins: 1 })

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong-password' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    })

    it('throws INVALID_CREDENTIALS when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    })

    it(`locks account after ${MAX_FAILED_LOGINS} consecutive failed attempts`, async () => {
      const bcrypt = await import('bcrypt')
      const hash = await bcrypt.hash('correct', 10)
      // User already has MAX_FAILED_LOGINS - 1 failed attempts
      const user = makeUser({ passwordHash: hash, failedLogins: MAX_FAILED_LOGINS - 1 })

      prisma.user.findUnique.mockResolvedValue(user)
      prisma.user.update.mockResolvedValue({ ...user, isLocked: true })

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' })

      // lockAccount should have been called
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isLocked: true }),
        }),
      )
    })

    it('throws ACCOUNT_LOCKED when account is locked and lock has not expired', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000) // 10 min from now
      const user = makeUser({ isLocked: true, lockedUntil })

      prisma.user.findUnique.mockResolvedValue(user)

      await expect(
        service.login({ email: 'test@example.com', password: 'any' }),
      ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' })
    })

    it('resets lock and allows login when lock has expired', async () => {
      const bcrypt = await import('bcrypt')
      const hash = await bcrypt.hash('password123', 10)
      const lockedUntil = new Date(Date.now() - 1000) // expired 1 second ago
      const user = makeUser({ passwordHash: hash, isLocked: true, lockedUntil, failedLogins: MAX_FAILED_LOGINS })

      prisma.user.findUnique.mockResolvedValue(user)
      // First update resets lock, second update resets failedLogins after success
      prisma.user.update.mockResolvedValue({ ...user, isLocked: false, lockedUntil: null, failedLogins: 0 })

      const result = await service.login({ email: 'test@example.com', password: 'password123' })
      expect(result).toEqual({ userId: 'user-1' })
    })
  })

  // ── lockAccount ───────────────────────────────────────────────────────────

  describe('lockAccount', () => {
    it(`locks account for ${ACCOUNT_LOCK_DURATION_MINUTES} minutes`, async () => {
      prisma.user.update.mockResolvedValue(makeUser({ isLocked: true }))

      await service.lockAccount('user-1', ACCOUNT_LOCK_DURATION_MINUTES)

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            isLocked: true,
            failedLogins: MAX_FAILED_LOGINS,
          }),
        }),
      )

      const callArg = prisma.user.update.mock.calls[0][0] as { data: { lockedUntil: Date } }
      const lockedUntil = callArg.data.lockedUntil
      const expectedMin = new Date(Date.now() + (ACCOUNT_LOCK_DURATION_MINUTES - 1) * 60 * 1000)
      const expectedMax = new Date(Date.now() + (ACCOUNT_LOCK_DURATION_MINUTES + 1) * 60 * 1000)
      expect(lockedUntil.getTime()).toBeGreaterThan(expectedMin.getTime())
      expect(lockedUntil.getTime()).toBeLessThan(expectedMax.getTime())
    })
  })

  // ── verifyEmail ───────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('marks email as verified with a valid token', async () => {
      const user = makeUser()
      prisma.user.findUnique.mockResolvedValue(user)
      prisma.user.update.mockResolvedValue({ ...user, emailVerified: true })

      const token = service.generateEmailVerificationToken(user.id, user.email)
      await service.verifyEmail(token)

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: { emailVerified: true },
        }),
      )
    })

    it('throws INVALID_TOKEN for a tampered token', async () => {
      const user = makeUser()
      prisma.user.findUnique.mockResolvedValue(user)

      const badToken = Buffer.from(`${user.id}:badhash`).toString('base64')
      await expect(service.verifyEmail(badToken)).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
    })

    it('throws INVALID_TOKEN for a malformed token', async () => {
      await expect(service.verifyEmail('not-base64-valid-token!!')).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      })
    })
  })

  // ── updateProfile ─────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('updates name and username', async () => {
      const user = makeUser()
      prisma.user.findUnique
        .mockResolvedValueOnce(user) // findUnique for user
        .mockResolvedValueOnce(null) // findUnique for username uniqueness check
      prisma.user.update.mockResolvedValue({ ...user, name: 'New Name', username: 'newusername' })

      const result = await service.updateProfile('user-1', { name: 'New Name', username: 'newusername' })
      expect(result.name).toBe('New Name')
      expect(result.username).toBe('newusername')
    })

    it('throws DUPLICATE_USERNAME when new username is taken', async () => {
      const user = makeUser()
      prisma.user.findUnique
        .mockResolvedValueOnce(user) // user lookup
        .mockResolvedValueOnce(makeUser({ id: 'other-user', username: 'takenname' })) // username check

      await expect(
        service.updateProfile('user-1', { username: 'takenname' }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_USERNAME' })
    })

    it('throws CURRENT_PASSWORD_REQUIRED when changing password without current password', async () => {
      const user = makeUser()
      prisma.user.findUnique.mockResolvedValue(user)

      await expect(
        service.updateProfile('user-1', { newPassword: 'newpass123' }),
      ).rejects.toMatchObject({ code: 'CURRENT_PASSWORD_REQUIRED' })
    })

    it('throws INVALID_CREDENTIALS when current password is wrong', async () => {
      const bcrypt = await import('bcrypt')
      const hash = await bcrypt.hash('correct', 10)
      const user = makeUser({ passwordHash: hash })
      prisma.user.findUnique.mockResolvedValue(user)

      await expect(
        service.updateProfile('user-1', { currentPassword: 'wrong', newPassword: 'newpass123' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    })

    it('marks email as unverified when email is changed', async () => {
      const user = makeUser({ emailVerified: true })
      prisma.user.findUnique
        .mockResolvedValueOnce(user) // user lookup
        .mockResolvedValueOnce(null) // email uniqueness check
      prisma.user.update.mockResolvedValue({ ...user, email: 'new@example.com', emailVerified: false })

      const result = await service.updateProfile('user-1', { newEmail: 'new@example.com' })
      expect(result.emailVerified).toBe(false)
    })

    it('throws DUPLICATE_EMAIL when new email is already registered', async () => {
      const user = makeUser()
      prisma.user.findUnique
        .mockResolvedValueOnce(user) // user lookup
        .mockResolvedValueOnce(makeUser({ id: 'other', email: 'taken@example.com' })) // email check

      await expect(
        service.updateProfile('user-1', { newEmail: 'taken@example.com' }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_EMAIL' })
    })
  })
})
