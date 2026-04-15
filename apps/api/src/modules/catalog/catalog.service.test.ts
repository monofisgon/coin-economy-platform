import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TransactionType, BusinessStatus, WalletOwner } from '@prisma/client'
import { CatalogService } from './catalog.service'

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeBusiness(overrides: Record<string, unknown> = {}) {
  return {
    id: 'biz-1',
    ownerId: 'owner-1',
    name: 'Test Business',
    description: 'A test business',
    category: 'Food',
    address: 'Calle 10, Bogotá',
    latitude: 4.6,
    longitude: -74.1,
    status: BusinessStatus.ACTIVE,
    profilePhoto: null,
    coverPhoto: null,
    socialLinks: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    businessId: 'biz-1',
    name: 'Test Product',
    description: 'A test product',
    imageUrl: null,
    coinPrice: '10',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeWallet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wallet-1',
    ownerType: WalletOwner.USER,
    userId: 'user-1',
    businessId: null,
    coinBalance: '100',
    diamondBalance: '0',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeBusinessWallet(overrides: Record<string, unknown> = {}) {
  return makeWallet({
    id: 'biz-wallet-1',
    ownerType: WalletOwner.BUSINESS,
    userId: null,
    businessId: 'biz-1',
    ...overrides,
  })
}

function makePrismaMock() {
  return {
    business: { findUnique: vi.fn() },
    product: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    wallet: { findUnique: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn() },
    notification: { create: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CatalogService', () => {
  let prisma: ReturnType<typeof makePrismaMock>
  let service: CatalogService

  beforeEach(() => {
    prisma = makePrismaMock()
    service = new CatalogService(prisma as never)
  })

  // ─── createProduct ──────────────────────────────────────────────────────────

  describe('createProduct', () => {
    it('creates a product for the business owner', async () => {
      const business = makeBusiness()
      const product = makeProduct()
      prisma.business.findUnique.mockResolvedValue(business)
      prisma.product.create.mockResolvedValue(product)

      const result = await service.createProduct('biz-1', 'owner-1', {
        name: 'Test Product',
        description: 'A test product',
        coinPrice: 10,
      })

      expect(result.name).toBe('Test Product')
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ coinPrice: 10, isActive: true }),
        }),
      )
    })

    it('throws FORBIDDEN when requester is not the owner', async () => {
      prisma.business.findUnique.mockResolvedValue(makeBusiness())

      await expect(
        service.createProduct('biz-1', 'other-user', {
          name: 'Test',
          description: 'Test',
          coinPrice: 10,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('throws INVALID_PRODUCT_PRICE when coinPrice <= 0', async () => {
      prisma.business.findUnique.mockResolvedValue(makeBusiness())

      await expect(
        service.createProduct('biz-1', 'owner-1', {
          name: 'Test',
          description: 'Test',
          coinPrice: 0,
        }),
      ).rejects.toMatchObject({ code: 'INVALID_PRODUCT_PRICE' })
    })

    it('throws BUSINESS_NOT_FOUND for non-existent business', async () => {
      prisma.business.findUnique.mockResolvedValue(null)

      await expect(
        service.createProduct('nonexistent', 'owner-1', {
          name: 'Test',
          description: 'Test',
          coinPrice: 10,
        }),
      ).rejects.toMatchObject({ code: 'BUSINESS_NOT_FOUND' })
    })
  })

  // ─── updateProduct ──────────────────────────────────────────────────────────

  describe('updateProduct', () => {
    it('updates a product for the business owner', async () => {
      const business = makeBusiness()
      const product = makeProduct()
      const updated = { ...product, name: 'Updated Name' }
      prisma.business.findUnique.mockResolvedValue(business)
      prisma.product.findUnique.mockResolvedValue(product)
      prisma.product.update.mockResolvedValue(updated)

      const result = await service.updateProduct('biz-1', 'prod-1', 'owner-1', {
        name: 'Updated Name',
      })

      expect(result.name).toBe('Updated Name')
    })

    it('throws INVALID_PRODUCT_PRICE when updating coinPrice to <= 0', async () => {
      prisma.business.findUnique.mockResolvedValue(makeBusiness())
      prisma.product.findUnique.mockResolvedValue(makeProduct())

      await expect(
        service.updateProduct('biz-1', 'prod-1', 'owner-1', { coinPrice: -5 }),
      ).rejects.toMatchObject({ code: 'INVALID_PRODUCT_PRICE' })
    })

    it('throws PRODUCT_NOT_FOUND for non-existent product', async () => {
      prisma.business.findUnique.mockResolvedValue(makeBusiness())
      prisma.product.findUnique.mockResolvedValue(null)

      await expect(
        service.updateProduct('biz-1', 'nonexistent', 'owner-1', { name: 'X' }),
      ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' })
    })
  })

  // ─── deactivateProduct ──────────────────────────────────────────────────────

  describe('deactivateProduct', () => {
    it('sets isActive=false (soft delete)', async () => {
      const business = makeBusiness()
      const product = makeProduct()
      const deactivated = { ...product, isActive: false }
      prisma.business.findUnique.mockResolvedValue(business)
      prisma.product.findUnique.mockResolvedValue(product)
      prisma.product.update.mockResolvedValue(deactivated)

      const result = await service.deactivateProduct('biz-1', 'prod-1', 'owner-1')

      expect(result.isActive).toBe(false)
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      )
    })

    it('throws FORBIDDEN when requester is not the owner', async () => {
      prisma.business.findUnique.mockResolvedValue(makeBusiness())

      await expect(
        service.deactivateProduct('biz-1', 'prod-1', 'other-user'),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  // ─── getCatalogByLocation ───────────────────────────────────────────────────

  describe('getCatalogByLocation', () => {
    it('returns active products from active businesses matching location', async () => {
      const products = [
        {
          ...makeProduct(),
          business: {
            id: 'biz-1',
            name: 'Test Business',
            latitude: 4.6,
            longitude: -74.1,
          },
        },
      ]
      prisma.product.findMany.mockResolvedValue(products)

      const result = await service.getCatalogByLocation('Bogotá')

      expect(result).toHaveLength(1)
      expect(result[0].businessName).toBe('Test Business')
      expect(result[0].businessId).toBe('biz-1')
      expect(result[0].latitude).toBe(4.6)
      expect(result[0].longitude).toBe(-74.1)
    })

    it('filters by location case-insensitively', async () => {
      prisma.product.findMany.mockResolvedValue([])

      await service.getCatalogByLocation('bogotá')

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            business: expect.objectContaining({
              status: BusinessStatus.ACTIVE,
              address: expect.objectContaining({ mode: 'insensitive' }),
            }),
          }),
        }),
      )
    })
  })

  // ─── purchaseProduct ────────────────────────────────────────────────────────

  describe('purchaseProduct', () => {
    it('deducts coinPrice from buyer wallet and creates transaction', async () => {
      const product = {
        ...makeProduct(),
        coinPrice: '10',
        business: {
          ...makeBusiness(),
          wallet: makeBusinessWallet(),
          owner: { id: 'owner-1' },
        },
      }
      const buyerWallet = makeWallet({ coinBalance: '100' })
      const createdTx = {
        id: 'tx-1',
        type: TransactionType.PRODUCT_PURCHASE,
        fromWalletId: 'wallet-1',
        toWalletId: 'biz-wallet-1',
        coinAmount: '10',
        metadata: {},
        createdAt: new Date(),
      }

      prisma.product.findUnique.mockResolvedValue(product)
      prisma.wallet.findUnique.mockResolvedValue(buyerWallet)
      prisma.notification.create.mockResolvedValue({})

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          wallet: {
            findUnique: vi.fn().mockResolvedValue({ coinBalance: '100' }),
            update: vi.fn().mockResolvedValue({}),
          },
          transaction: { create: vi.fn().mockResolvedValue(createdTx) },
        }
        return fn(tx)
      })

      const result = await service.purchaseProduct('prod-1', 'user-1')
      expect(result.type).toBe(TransactionType.PRODUCT_PURCHASE)
    })

    it('throws PRODUCT_INACTIVE when product is not active', async () => {
      const product = {
        ...makeProduct({ isActive: false }),
        business: {
          ...makeBusiness(),
          wallet: makeBusinessWallet(),
          owner: { id: 'owner-1' },
        },
      }
      prisma.product.findUnique.mockResolvedValue(product)

      await expect(service.purchaseProduct('prod-1', 'user-1')).rejects.toMatchObject({
        code: 'PRODUCT_INACTIVE',
      })
    })

    it('throws INSUFFICIENT_BALANCE when buyer has fewer coins than price', async () => {
      const product = {
        ...makeProduct({ coinPrice: '500' }),
        business: {
          ...makeBusiness(),
          wallet: makeBusinessWallet(),
          owner: { id: 'owner-1' },
        },
      }
      const buyerWallet = makeWallet({ coinBalance: '10' })

      prisma.product.findUnique.mockResolvedValue(product)
      prisma.wallet.findUnique.mockResolvedValue(buyerWallet)

      await expect(service.purchaseProduct('prod-1', 'user-1')).rejects.toMatchObject({
        code: 'INSUFFICIENT_BALANCE',
      })
    })

    it('throws PRODUCT_NOT_FOUND for non-existent product', async () => {
      prisma.product.findUnique.mockResolvedValue(null)

      await expect(service.purchaseProduct('nonexistent', 'user-1')).rejects.toMatchObject({
        code: 'PRODUCT_NOT_FOUND',
      })
    })

    it('creates a notification for the Business_Owner after purchase', async () => {
      const product = {
        ...makeProduct(),
        coinPrice: '10',
        business: {
          ...makeBusiness(),
          wallet: makeBusinessWallet(),
          owner: { id: 'owner-1' },
        },
      }
      const buyerWallet = makeWallet({ coinBalance: '100' })
      const createdTx = {
        id: 'tx-1',
        type: TransactionType.PRODUCT_PURCHASE,
        fromWalletId: 'wallet-1',
        toWalletId: 'biz-wallet-1',
        coinAmount: '10',
        metadata: {},
        createdAt: new Date(),
      }

      prisma.product.findUnique.mockResolvedValue(product)
      prisma.wallet.findUnique.mockResolvedValue(buyerWallet)
      prisma.notification.create.mockResolvedValue({})

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          wallet: {
            findUnique: vi.fn().mockResolvedValue({ coinBalance: '100' }),
            update: vi.fn().mockResolvedValue({}),
          },
          transaction: { create: vi.fn().mockResolvedValue(createdTx) },
        }
        return fn(tx)
      })

      await service.purchaseProduct('prod-1', 'user-1')

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'owner-1',
            type: 'PRODUCT_PURCHASED',
          }),
        }),
      )
    })
  })
})
