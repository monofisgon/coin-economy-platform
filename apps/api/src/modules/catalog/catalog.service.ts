import { PrismaClient, TransactionType, BusinessStatus, WalletOwner } from '@prisma/client'
import type { Product, Transaction } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { CreateProductDTO, UpdateProductDTO } from './catalog.schema'

export interface CatalogProduct {
  id: string
  name: string
  description: string
  imageUrl: string | null
  coinPrice: unknown
  isActive: boolean
  createdAt: Date
  businessId: string
  businessName: string
  latitude: number
  longitude: number
}

export class CatalogService {
  constructor(private readonly prisma: PrismaClient) {}

  // ─── createProduct ──────────────────────────────────────────────────────────

  /**
   * Create a product for a business (Business_Owner only).
   * Requirements: 7.1, 7.9
   */
  async createProduct(
    businessId: string,
    requesterId: string,
    data: CreateProductDTO,
  ): Promise<Product> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } })
    if (!business) {
      const err = new Error('Business not found')
      ;(err as NodeJS.ErrnoException).code = 'BUSINESS_NOT_FOUND'
      throw err
    }

    if (business.ownerId !== requesterId) {
      const err = new Error('Only the business owner can manage products')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    if (data.coinPrice <= 0) {
      const err = new Error('coinPrice must be greater than 0')
      ;(err as NodeJS.ErrnoException).code = 'INVALID_PRODUCT_PRICE'
      throw err
    }

    return this.prisma.product.create({
      data: {
        businessId,
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl ?? null,
        coinPrice: data.coinPrice,
        isActive: true,
      },
    })
  }

  // ─── updateProduct ──────────────────────────────────────────────────────────

  /**
   * Update a product (Business_Owner only).
   * Requirements: 7.2, 7.9
   */
  async updateProduct(
    businessId: string,
    productId: string,
    requesterId: string,
    data: UpdateProductDTO,
  ): Promise<Product> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } })
    if (!business) {
      const err = new Error('Business not found')
      ;(err as NodeJS.ErrnoException).code = 'BUSINESS_NOT_FOUND'
      throw err
    }

    if (business.ownerId !== requesterId) {
      const err = new Error('Only the business owner can manage products')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product || product.businessId !== businessId) {
      const err = new Error('Product not found')
      ;(err as NodeJS.ErrnoException).code = 'PRODUCT_NOT_FOUND'
      throw err
    }

    if (data.coinPrice !== undefined && data.coinPrice <= 0) {
      const err = new Error('coinPrice must be greater than 0')
      ;(err as NodeJS.ErrnoException).code = 'INVALID_PRODUCT_PRICE'
      throw err
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.coinPrice !== undefined && { coinPrice: data.coinPrice }),
      },
    })
  }

  // ─── deactivateProduct ──────────────────────────────────────────────────────

  /**
   * Soft-delete a product by setting isActive=false (Business_Owner only).
   * Requirements: 7.3
   */
  async deactivateProduct(
    businessId: string,
    productId: string,
    requesterId: string,
  ): Promise<Product> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } })
    if (!business) {
      const err = new Error('Business not found')
      ;(err as NodeJS.ErrnoException).code = 'BUSINESS_NOT_FOUND'
      throw err
    }

    if (business.ownerId !== requesterId) {
      const err = new Error('Only the business owner can manage products')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product || product.businessId !== businessId) {
      const err = new Error('Product not found')
      ;(err as NodeJS.ErrnoException).code = 'PRODUCT_NOT_FOUND'
      throw err
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    })
  }

  // ─── getCatalogByLocation ───────────────────────────────────────────────────

  /**
   * Get active products from active businesses filtered by location (address text search).
   * Requirements: 7.4, 7.5, 7.6, 7.7, 7.8
   */
  async getCatalogByLocation(location: string): Promise<CatalogProduct[]> {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        business: {
          status: BusinessStatus.ACTIVE,
          address: {
            contains: location,
            mode: 'insensitive',
          },
        },
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      coinPrice: p.coinPrice,
      isActive: p.isActive,
      createdAt: p.createdAt,
      businessId: p.business.id,
      businessName: p.business.name,
      latitude: p.business.latitude,
      longitude: p.business.longitude,
    }))
  }

  // ─── purchaseProduct ────────────────────────────────────────────────────────

  /**
   * Purchase a product with Coins from the User Wallet.
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   */
  async purchaseProduct(
    productId: string,
    buyerUserId: string,
  ): Promise<Transaction> {
    // Load product with business info
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        business: {
          include: {
            wallet: true,
            owner: true,
          },
        },
      },
    })

    if (!product) {
      const err = new Error('Product not found')
      ;(err as NodeJS.ErrnoException).code = 'PRODUCT_NOT_FOUND'
      throw err
    }

    // Requirement 8.4: reject purchase of inactive product
    if (!product.isActive) {
      const err = new Error('Product is not available for purchase')
      ;(err as NodeJS.ErrnoException).code = 'PRODUCT_INACTIVE'
      throw err
    }

    // Load buyer's wallet
    const buyerWallet = await this.prisma.wallet.findUnique({
      where: { userId: buyerUserId },
    })

    if (!buyerWallet) {
      const err = new Error('Buyer wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    const coinPrice = new Prisma.Decimal(product.coinPrice)

    // Requirement 8.3: reject if insufficient balance
    if (new Prisma.Decimal(buyerWallet.coinBalance).lt(coinPrice)) {
      const err = new Error('Insufficient coin balance to purchase this product')
      ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
      throw err
    }

    const businessWallet = product.business.wallet
    if (!businessWallet) {
      const err = new Error('Business wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    // Execute atomically
    const transaction = await this.prisma.$transaction(async (prisma) => {
      // Lock both wallets (order by id to prevent deadlocks)
      const ids = [buyerWallet.id, businessWallet.id].sort()
      await prisma.$queryRaw`
        SELECT * FROM "Wallet" WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE
      `

      // Re-read buyer balance inside transaction
      const lockedBuyer = await prisma.wallet.findUnique({
        where: { id: buyerWallet.id },
        select: { coinBalance: true },
      })

      if (!lockedBuyer) throw new Error('Buyer wallet not found')

      if (new Prisma.Decimal(lockedBuyer.coinBalance).lt(coinPrice)) {
        const err = new Error('Insufficient coin balance to purchase this product')
        ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
        throw err
      }

      // Deduct from buyer wallet (Requirement 8.1)
      await prisma.wallet.update({
        where: { id: buyerWallet.id },
        data: { coinBalance: { decrement: coinPrice } },
      })

      // Create Transaction record (Requirement 8.2)
      const tx = await prisma.transaction.create({
        data: {
          type: TransactionType.PRODUCT_PURCHASE,
          fromWalletId: buyerWallet.id,
          toWalletId: businessWallet.id,
          coinAmount: coinPrice,
          metadata: {
            productId: product.id,
            productName: product.name,
            buyerUserId,
            businessId: product.businessId,
          },
        },
      })

      return tx
    })

    // Requirement 8.5: notify Business_Owner
    await this.prisma.notification.create({
      data: {
        userId: product.business.ownerId,
        type: 'PRODUCT_PURCHASED',
        payload: {
          productId: product.id,
          productName: product.name,
          buyerUserId,
        },
      },
    })

    return transaction
  }
}
