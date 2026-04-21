import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import { RankingService, type RankingType } from './ranking.service'
import { ACTIVE_BUSINESS_THRESHOLD } from '@krowdco/shared'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMockPrisma(activeBusinessCount: number) {
  return {
    business: {
      count: async () => activeBusinessCount,
    },
    rankingSnapshot: {
      findFirst: async () => null,
    },
  } as unknown as import('@prisma/client').PrismaClient
}

const RANKING_TYPES: RankingType[] = [
  'USER_COINS_SOLD',
  'USER_COINS_BALANCE',
  'USER_COINS_REDEEMED',
  'BUSINESS_COINS_DONATED',
  'BUSINESS_COINS_PURCHASED',
  'BUSINESS_COINS_REDEEMED_ON',
]

// ─── Property 27: Rankings ocultos con menos de 500 negocios activos ─────────

// Feature: coin-economy-platform, Property 27: Rankings ocultos con menos de 500 negocios activos
describe('Property 27: Rankings hidden with fewer than 500 active businesses', () => {
  test('any ranking query returns available=false when active businesses < 500', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Active business count strictly below threshold
        fc.integer({ min: 0, max: ACTIVE_BUSINESS_THRESHOLD - 1 }),
        fc.constantFrom(...RANKING_TYPES),
        fc.option(fc.integer({ min: 2020, max: 2030 }), { nil: undefined }),
        async (activeCount, rankingType, year) => {
          const prisma = buildMockPrisma(activeCount)
          const service = new RankingService(prisma)

          const result = await service.getRankings(rankingType, year)

          expect(result.available).toBe(false)
          expect(result.entries).toHaveLength(0)
          expect(result.message).toBeDefined()
          expect(result.message).toContain(String(ACTIVE_BUSINESS_THRESHOLD))
        },
      ),
      { numRuns: 100 },
    )
  })

  test('isRankingActive returns false when active businesses < 500', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: ACTIVE_BUSINESS_THRESHOLD - 1 }),
        async (activeCount) => {
          const prisma = buildMockPrisma(activeCount)
          const service = new RankingService(prisma)

          const active = await service.isRankingActive()
          expect(active).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  test('isRankingActive returns true when active businesses >= 500', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: ACTIVE_BUSINESS_THRESHOLD, max: ACTIVE_BUSINESS_THRESHOLD + 1000 }),
        async (activeCount) => {
          const prisma = buildMockPrisma(activeCount)
          const service = new RankingService(prisma)

          const active = await service.isRankingActive()
          expect(active).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
