import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BusinessStatus, WalletOwner } from '@prisma/client'
import { BusinessService } from './business.service'
import { MAX_BUSINESSES_PER_USER } from '@krowdco/shared'

// Minimal Prisma mock
function makePrismaMock() {
  return {
    business: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    wallet: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }
}

const baseBusinessData = {
  name: 'Test Business',
  description: 'A test business',
  category: 'Food',
  address: 'Calle 1 #2-3',
  latitude: 4.6,
  longitude: -74.1,
}

describe('BusinessService', () => {
  let prisma: ReturnType<typeof makePrismaMock>
  let service: BusinessService

  beforeEach(() => {
    prisma = makePrismaMock()
    service = new BusinessService(prisma as never)
  })

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a business and wallet atomically when under the limit', async () => {
      prisma.business.count.mockResolvedValue(0)

      const createdBusiness = {
        id: 'biz-1',
        ownerId: 'user-1',
        ...baseBusinessData,
        profilePhoto: null,
        coverPhoto: null,
        socialLinks: null,
        status: BusinessStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // $transaction executes the callback with a tx object
      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          business: { create: vi.fn().mockResolvedValue(createdBusiness) },
          wallet: { create: vi.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const result = await service.create('user-1', baseBusinessData)

      expect(result.status).toBe(BusinessStatus.PENDING)
      expect(result.ownerId).toBe('user-1')
    })

    it('sets status to PENDING on creation (Req 2.11)', async () => {
      prisma.business.count.mockResolvedValue(1)

      const createdBusiness = {
        id: 'biz-2',
        ownerId: 'user-1',
        ...baseBusinessData,
        profilePhoto: null,
        coverPhoto: null,
        socialLinks: null,
        status: BusinessStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          business: { create: vi.fn().mockResolvedValue(createdBusiness) },
          wallet: { create: vi.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const result = await service.create('user-1', baseBusinessData)
      expect(result.status).toBe(BusinessStatus.PENDING)
    })

    it('creates a wallet with coinBalance=0 and ownerType=BUSINESS (Req 2.2)', async () => {
      prisma.business.count.mockResolvedValue(0)

      const createdBusiness = {
        id: 'biz-3',
        ownerId: 'user-1',
        ...baseBusinessData,
        profilePhoto: null,
        coverPhoto: null,
        socialLinks: null,
        status: BusinessStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      let walletCreateArgs: unknown
      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          business: { create: vi.fn().mockResolvedValue(createdBusiness) },
          wallet: {
            create: vi.fn().mockImplementation((args: unknown) => {
              walletCreateArgs = args
              return Promise.resolve({})
            }),
          },
        }
        return cb(tx)
      })

      await service.create('user-1', baseBusinessData)

      expect(walletCreateArgs).toMatchObject({
        data: {
          ownerType: WalletOwner.BUSINESS,
          businessId: 'biz-3',
          coinBalance: 0,
          diamondBalance: 0,
        },
      })
    })

    it('rejects when user already has MAX_BUSINESSES_PER_USER businesses (Req 2.8)', async () => {
      prisma.business.count.mockResolvedValue(MAX_BUSINESSES_PER_USER)

      await expect(service.create('user-1', baseBusinessData)).rejects.toMatchObject({
        code: 'BUSINESS_LIMIT_REACHED',
      })
    })

    it('allows creation when user has exactly MAX-1 businesses', async () => {
      prisma.business.count.mockResolvedValue(MAX_BUSINESSES_PER_USER - 1)

      const createdBusiness = {
        id: 'biz-4',
        ownerId: 'user-1',
        ...baseBusinessData,
        profilePhoto: null,
        coverPhoto: null,
        socialLinks: null,
        status: BusinessStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          business: { create: vi.fn().mockResolvedValue(createdBusiness) },
          wallet: { create: vi.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const result = await service.create('user-1', baseBusinessData)
      expect(result).toBeDefined()
    })
  })

  // ─── activate ────────────────────────────────────────────────────────────

  describe('activate', () => {
    it('transitions business from PENDING to ACTIVE', async () => {
      const business = { id: 'biz-1', status: BusinessStatus.PENDING, ownerId: 'user-1' }
      prisma.business.findUnique.mockResolvedValue(business)
      prisma.business.update.mockResolvedValue({ ...business, status: BusinessStatus.ACTIVE })

      const result = await service.activate('biz-1')
      expect(result.status).toBe(BusinessStatus.ACTIVE)
      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz-1' },
        data: { status: BusinessStatus.ACTIVE },
      })
    })

    it('throws BUSINESS_NOT_FOUND when business does not exist', async () => {
      prisma.business.findUnique.mockResolvedValue(null)

      await expect(service.activate('nonexistent')).rejects.toMatchObject({
        code: 'BUSINESS_NOT_FOUND',
      })
    })
  })

  // ─── update ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates business fields when caller is the owner', async () => {
      const business = { id: 'biz-1', ownerId: 'user-1', status: BusinessStatus.ACTIVE }
      prisma.business.findUnique.mockResolvedValue(business)
      prisma.business.update.mockResolvedValue({ ...business, name: 'Updated Name' })

      const result = await service.update('biz-1', 'user-1', { name: 'Updated Name' })
      expect(result.name).toBe('Updated Name')
    })

    it('throws FORBIDDEN when caller is not the owner', async () => {
      const business = { id: 'biz-1', ownerId: 'user-1', status: BusinessStatus.ACTIVE }
      prisma.business.findUnique.mockResolvedValue(business)

      await expect(service.update('biz-1', 'other-user', { name: 'Hack' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    })

    it('throws BUSINESS_NOT_FOUND when business does not exist', async () => {
      prisma.business.findUnique.mockResolvedValue(null)

      await expect(service.update('nonexistent', 'user-1', {})).rejects.toMatchObject({
        code: 'BUSINESS_NOT_FOUND',
      })
    })
  })

  // ─── getProfile ──────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns business profile with active products only', async () => {
      const profile = {
        id: 'biz-1',
        ownerId: 'user-1',
        ...baseBusinessData,
        profilePhoto: null,
        coverPhoto: null,
        socialLinks: null,
        status: BusinessStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        products: [
          { id: 'p-1', name: 'Product 1', description: 'Desc', imageUrl: null, coinPrice: 10, isActive: true, createdAt: new Date() },
        ],
      }
      prisma.business.findUnique.mockResolvedValue(profile)

      const result = await service.getProfile('biz-1')
      expect(result.products).toHaveLength(1)
      expect(result.products[0].isActive).toBe(true)
    })

    it('throws BUSINESS_NOT_FOUND when business does not exist', async () => {
      prisma.business.findUnique.mockResolvedValue(null)

      await expect(service.getProfile('nonexistent')).rejects.toMatchObject({
        code: 'BUSINESS_NOT_FOUND',
      })
    })
  })

  // ─── listByOwner ─────────────────────────────────────────────────────────

  describe('listByOwner', () => {
    it('returns all businesses for the given owner', async () => {
      const businesses = [
        { id: 'biz-1', ownerId: 'user-1' },
        { id: 'biz-2', ownerId: 'user-1' },
      ]
      prisma.business.findMany.mockResolvedValue(businesses)

      const result = await service.listByOwner('user-1')
      expect(result).toHaveLength(2)
      expect(prisma.business.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      })
    })

    it('returns empty array when owner has no businesses', async () => {
      prisma.business.findMany.mockResolvedValue([])

      const result = await service.listByOwner('user-1')
      expect(result).toHaveLength(0)
    })
  })
})
