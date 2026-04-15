import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import { FollowService } from './follow.service'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type MockFollow = {
  id: string
  followerId: string
  followedUserId: string | null
  followedBizId: string | null
  createdAt: Date
}

/**
 * Build an in-memory mock PrismaClient for Follow tests.
 */
function buildMockPrisma(initialFollows: MockFollow[] = []) {
  const follows: MockFollow[] = [...initialFollows]
  let idCounter = 0

  return {
    follow: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        return (
          follows.find(
            (f) =>
              f.followerId === where.followerId &&
              (where.followedUserId === undefined || f.followedUserId === where.followedUserId) &&
              (where.followedBizId === undefined || f.followedBizId === where.followedBizId),
          ) ?? null
        )
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return follows.find((f) => f.id === where.id) ?? null
      },
      findMany: async ({ where }: { where: { followerId?: string } }) => {
        return follows.filter((f) => !where.followerId || f.followerId === where.followerId)
      },
      create: async ({ data }: { data: Omit<MockFollow, 'id' | 'createdAt'> }) => {
        const follow: MockFollow = {
          id: `follow-${++idCounter}`,
          followerId: data.followerId,
          followedUserId: data.followedUserId ?? null,
          followedBizId: data.followedBizId ?? null,
          createdAt: new Date(),
        }
        follows.push(follow)
        return follow
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = follows.findIndex((f) => f.id === where.id)
        if (idx !== -1) follows.splice(idx, 1)
      },
    },
    product: {
      findMany: async () => [],
    },
    offer: {
      findMany: async () => [],
    },
  } as unknown as import('@prisma/client').PrismaClient
}

// ─── Property 30: Round-trip Follow/Unfollow en Feed ─────────────────────────

// Feature: coin-economy-platform, Property 30: Round-trip de Follow/Unfollow en Feed
describe('Property 30: Follow/Unfollow round-trip', () => {
  test('after unfollow, the follow no longer exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // followerId
        fc.uuid(), // followedUserId
        async (followerId, followedUserId) => {
          const prisma = buildMockPrisma()
          const service = new FollowService(prisma)

          // Create follow
          const follow = await service.createFollow(followerId, { followedUserId })
          expect(follow.followerId).toBe(followerId)
          expect(follow.followedUserId).toBe(followedUserId)

          // Unfollow
          await service.deleteFollow(followerId, follow.id)

          // Verify follow is gone — trying to delete again should throw FOLLOW_NOT_FOUND
          await expect(service.deleteFollow(followerId, follow.id)).rejects.toMatchObject({
            code: 'FOLLOW_NOT_FOUND',
          })
        },
      ),
      { numRuns: 100 },
    )
  })

  test('feed is empty after unfollowing all accounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // followerId
        fc.uuid(), // followedBizId
        async (followerId, followedBizId) => {
          const prisma = buildMockPrisma()
          const service = new FollowService(prisma)

          // Follow a business
          const follow = await service.createFollow(followerId, { followedBizId })

          // Unfollow
          await service.deleteFollow(followerId, follow.id)

          // Feed should be empty with message
          const feed = await service.getFeed(followerId)
          expect(feed.items).toHaveLength(0)
          expect(feed.message).toBeDefined()
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Property 31: Idempotencia negativa de Follow ────────────────────────────

// Feature: coin-economy-platform, Property 31: Idempotencia negativa de Follow
describe('Property 31: Negative idempotency of Follow', () => {
  test('duplicate follow is rejected with FOLLOW_ALREADY_EXISTS', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // followerId
        fc.uuid(), // followedUserId
        async (followerId, followedUserId) => {
          const prisma = buildMockPrisma()
          const service = new FollowService(prisma)

          // First follow succeeds
          await service.createFollow(followerId, { followedUserId })

          // Second follow must be rejected
          await expect(service.createFollow(followerId, { followedUserId })).rejects.toMatchObject({
            code: 'FOLLOW_ALREADY_EXISTS',
          })
        },
      ),
      { numRuns: 100 },
    )
  })

  test('unfollow of non-existent follow is rejected with FOLLOW_NOT_FOUND', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // followerId
        fc.uuid(), // non-existent followId
        async (followerId, nonExistentId) => {
          const prisma = buildMockPrisma()
          const service = new FollowService(prisma)

          await expect(service.deleteFollow(followerId, nonExistentId)).rejects.toMatchObject({
            code: 'FOLLOW_NOT_FOUND',
          })
        },
      ),
      { numRuns: 100 },
    )
  })
})
