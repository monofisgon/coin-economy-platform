import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import { SearchService } from './search.service'

// ─── Mocks ───────────────────────────────────────────────────────────────────

/**
 * Build a mock PrismaClient that returns controlled data for search tests.
 */
function buildMockPrisma(businesses: unknown[], users: unknown[]) {
  return {
    business: {
      findMany: async ({ where }: { where: { status?: string } }) => {
        // Filter by ACTIVE status as the real service does
        const filtered = (businesses as Array<Record<string, unknown>>).filter(
          (b) => !where.status || b.status === where.status,
        )
        return filtered.map((b) => ({
          id: b.id,
          name: b.name,
          category: b.category,
          description: b.description,
          address: b.address,
          latitude: b.latitude,
          longitude: b.longitude,
          profilePhoto: b.profilePhoto ?? null,
          coverPhoto: b.coverPhoto ?? null,
          socialLinks: b.socialLinks ?? null,
        }))
      },
    },
    user: {
      findMany: async () =>
        (users as Array<Record<string, unknown>>).map((u) => ({
          id: u.id,
          username: u.username,
          profilePhoto: u.profilePhoto ?? null,
          socialLinks: u.socialLinks ?? null,
        })),
    },
  } as unknown as import('@prisma/client').PrismaClient
}

// ─── Property 25: Privacidad en resultados de búsqueda ───────────────────────

// Feature: coin-economy-platform, Property 25: Privacidad en resultados de búsqueda
describe('Property 25: Privacy in search results', () => {
  test('business search results never contain financial data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            category: fc.string({ minLength: 1, maxLength: 30 }),
            description: fc.string({ minLength: 1, maxLength: 100 }),
            address: fc.string({ minLength: 1, maxLength: 100 }),
            latitude: fc.float({ min: -90, max: 90, noNaN: true }),
            longitude: fc.float({ min: -180, max: 180, noNaN: true }),
            status: fc.constant('ACTIVE'),
            coinBalance: fc.integer({ min: 0, max: 100000 }),
            diamondBalance: fc.integer({ min: 0, max: 100000 }),
          }),
          { minLength: 0, maxLength: 10 },
        ),
        async (businesses) => {
          const prisma = buildMockPrisma(businesses, [])
          const service = new SearchService(prisma)
          const results = await service.searchBusinesses('test')

          for (const result of results) {
            // Must NOT contain financial fields
            expect(result).not.toHaveProperty('coinBalance')
            expect(result).not.toHaveProperty('diamondBalance')
            expect(result).not.toHaveProperty('wallet')
            // Must contain expected public fields
            expect(result).toHaveProperty('id')
            expect(result).toHaveProperty('name')
            expect(result).toHaveProperty('category')
            expect(result).toHaveProperty('description')
            expect(result).toHaveProperty('address')
            expect(result).toHaveProperty('latitude')
            expect(result).toHaveProperty('longitude')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  test('user search results never contain financial or private data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            username: fc.string({ minLength: 1, maxLength: 30 }),
            email: fc.emailAddress(),
            profilePhoto: fc.option(fc.webUrl(), { nil: null }),
            coinBalance: fc.integer({ min: 0, max: 100000 }),
            diamondBalance: fc.integer({ min: 0, max: 100000 }),
          }),
          { minLength: 0, maxLength: 10 },
        ),
        async (users) => {
          const prisma = buildMockPrisma([], users)
          const service = new SearchService(prisma)
          const results = await service.searchUsers('test')

          for (const result of results) {
            // Must NOT contain financial or private fields
            expect(result).not.toHaveProperty('email')
            expect(result).not.toHaveProperty('coinBalance')
            expect(result).not.toHaveProperty('diamondBalance')
            expect(result).not.toHaveProperty('wallet')
            expect(result).not.toHaveProperty('passwordHash')
            // Must contain expected public fields
            expect(result).toHaveProperty('id')
            expect(result).toHaveProperty('username')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Property 26: Solo negocios activos en búsqueda ──────────────────────────

// Feature: coin-economy-platform, Property 26: Solo negocios activos en búsqueda
describe('Property 26: Only active businesses in search', () => {
  test('search never returns PENDING businesses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            category: fc.string({ minLength: 1, maxLength: 30 }),
            description: fc.string({ minLength: 1, maxLength: 100 }),
            address: fc.string({ minLength: 1, maxLength: 100 }),
            latitude: fc.float({ min: -90, max: 90, noNaN: true }),
            longitude: fc.float({ min: -180, max: 180, noNaN: true }),
            status: fc.oneof(fc.constant('ACTIVE'), fc.constant('PENDING')),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (businesses) => {
          // The mock filters by status=ACTIVE as the real Prisma query does
          const prisma = buildMockPrisma(businesses, [])
          const service = new SearchService(prisma)
          const results = await service.searchBusinesses('')

          // All returned businesses must be ACTIVE (mock enforces this via status filter)
          const activeCount = businesses.filter((b) => b.status === 'ACTIVE').length
          expect(results.length).toBe(activeCount)
        },
      ),
      { numRuns: 100 },
    )
  })
})
