import {
  PrismaClient,
  TransactionType,
  WalletOwner,
  OfferVisibility,
  OfferStatus,
  Prisma,
} from '@prisma/client'
import type { Offer, Transaction } from '@prisma/client'
import { randomUUID } from 'crypto'
import type { CreateOfferDTO, ListOffersQueryDTO } from './marketplace.schema'

export interface OfferPublic {
  id: string
  sellerId: string
  visibility: OfferVisibility
  status: OfferStatus
  createdAt: Date
  updatedAt: Date
  // Only present for PUBLICA offers or when the requester is the seller
  coinAmount?: unknown
  diamondPricePerCoin?: unknown
}

export interface Page<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export class MarketplaceService {
  constructor(private readonly prisma: PrismaClient) {}

  // ─── createOffer ────────────────────────────────────────────────────────────

  /**
   * Create a Marketplace Offer (Users only, not Business_Owners).
   * Reserves coinAmount from the User Wallet.
   * Requirements: 9.1, 9.2, 9.3, 9.13, 9.14
   */
  async createOffer(userId: string, data: CreateOfferDTO): Promise<Offer> {
    // Verify the requester has a USER wallet (not a business owner acting on a business wallet)
    const userWallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { user: true },
    })

    if (!userWallet || userWallet.ownerType !== WalletOwner.USER) {
      const err = new Error('User wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    // Requirement 9.3: Business_Owners cannot create Offers
    // A Business_Owner is a user who owns at least one business.
    // We check if the user has any businesses — if so, they are a Business_Owner.
    const businessCount = await this.prisma.business.count({ where: { ownerId: userId } })
    if (businessCount > 0) {
      const err = new Error('Business_Owners are not permitted to publish Offers in the Marketplace')
      ;(err as NodeJS.ErrnoException).code = 'OFFER_CREATION_FORBIDDEN'
      throw err
    }

    const coinAmount = new Prisma.Decimal(data.coinAmount)

    // Requirement 9.2: reject if insufficient balance
    if (new Prisma.Decimal(userWallet.coinBalance).lt(coinAmount)) {
      const err = new Error('Insufficient coin balance to create this Offer')
      ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
      throw err
    }

    // Generate accessCode for private offers (Requirement 9.14)
    const accessCode =
      data.visibility === 'PRIVADA' ? randomUUID() : null

    // Execute atomically: reserve coins + create offer
    const offer = await this.prisma.$transaction(async (prisma) => {
      // Lock the wallet
      await prisma.$queryRaw`
        SELECT * FROM "Wallet" WHERE id = ${userWallet.id} FOR UPDATE
      `

      // Re-read balance inside transaction
      const locked = await prisma.wallet.findUnique({
        where: { id: userWallet.id },
        select: { coinBalance: true },
      })
      if (!locked) throw new Error('Wallet not found')

      if (new Prisma.Decimal(locked.coinBalance).lt(coinAmount)) {
        const err = new Error('Insufficient coin balance to create this Offer')
        ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
        throw err
      }

      // Reserve coins (decrement balance) — Requirement 9.1
      await prisma.wallet.update({
        where: { id: userWallet.id },
        data: { coinBalance: { decrement: coinAmount } },
      })

      // Create the Offer
      const newOffer = await prisma.offer.create({
        data: {
          sellerId: userId,
          coinAmount: data.coinAmount,
          diamondPricePerCoin: data.diamondPricePerCoin,
          visibility: data.visibility as OfferVisibility,
          accessCode,
          status: OfferStatus.ACTIVE,
        },
      })

      return newOffer
    })

    return offer
  }

  // ─── listOffers ─────────────────────────────────────────────────────────────

  /**
   * List active Offers ordered by diamondPricePerCoin ASC.
   * Private offers show only non-sensitive metadata.
   * Requirements: 9.4, 9.12, 9.15
   */
  async listOffers(filters: ListOffersQueryDTO, requesterId: string): Promise<Page<OfferPublic>> {
    const where: Prisma.OfferWhereInput = {
      status: OfferStatus.ACTIVE,
      ...(filters.coinAmountMin !== undefined || filters.coinAmountMax !== undefined
        ? {
            coinAmount: {
              ...(filters.coinAmountMin !== undefined ? { gte: filters.coinAmountMin } : {}),
              ...(filters.coinAmountMax !== undefined ? { lte: filters.coinAmountMax } : {}),
            },
          }
        : {}),
      ...(filters.diamondPriceMin !== undefined || filters.diamondPriceMax !== undefined
        ? {
            diamondPricePerCoin: {
              ...(filters.diamondPriceMin !== undefined ? { gte: filters.diamondPriceMin } : {}),
              ...(filters.diamondPriceMax !== undefined ? { lte: filters.diamondPriceMax } : {}),
            },
          }
        : {}),
    }

    const [offers, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        orderBy: { diamondPricePerCoin: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.offer.count({ where }),
    ])

    // Requirement 9.15: private offers hide coinAmount and diamondPricePerCoin
    const data: OfferPublic[] = offers.map((offer) => {
      const isOwner = offer.sellerId === requesterId
      const isPublic = offer.visibility === OfferVisibility.PUBLICA

      if (isPublic || isOwner) {
        return {
          id: offer.id,
          sellerId: offer.sellerId,
          visibility: offer.visibility,
          status: offer.status,
          createdAt: offer.createdAt,
          updatedAt: offer.updatedAt,
          coinAmount: offer.coinAmount,
          diamondPricePerCoin: offer.diamondPricePerCoin,
        }
      }

      // Private offer — hide sensitive fields
      return {
        id: offer.id,
        sellerId: offer.sellerId,
        visibility: offer.visibility,
        status: offer.status,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
      }
    })

    return { data, total, page: filters.page, limit: filters.limit }
  }

  // ─── getAccessCode ──────────────────────────────────────────────────────────

  /**
   * Return the accessCode of a private Offer — only the seller can access it.
   * Requirements: 9.16
   */
  async getAccessCode(userId: string, offerId: string): Promise<string> {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } })

    if (!offer) {
      const err = new Error('Offer not found')
      ;(err as NodeJS.ErrnoException).code = 'OFFER_NOT_FOUND'
      throw err
    }

    if (offer.sellerId !== userId) {
      const err = new Error('Only the seller can view the access code')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    if (offer.visibility !== OfferVisibility.PRIVADA || !offer.accessCode) {
      const err = new Error('This Offer does not have an access code')
      ;(err as NodeJS.ErrnoException).code = 'NO_ACCESS_CODE'
      throw err
    }

    return offer.accessCode
  }

  // ─── acceptOffer ────────────────────────────────────────────────────────────

  /**
   * Accept an Offer as a buyer (User or Business_Owner).
   * - For private offers: requires correct accessCode.
   * - Transfers reserved Coins to buyer, Diamonds from buyer to seller.
   * - Creates Transaction records and Notifications.
   * Requirements: 9.5, 9.6, 9.7, 9.8, 9.9, 9.17, 9.18
   */
  async acceptOffer(
    buyerUserId: string,
    offerId: string,
    accessCode?: string,
  ): Promise<{ saleTx: Transaction; purchaseTx: Transaction }> {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } })

    if (!offer) {
      const err = new Error('Offer not found')
      ;(err as NodeJS.ErrnoException).code = 'OFFER_NOT_FOUND'
      throw err
    }

    if (offer.status !== OfferStatus.ACTIVE) {
      const err = new Error('Offer is no longer active')
      ;(err as NodeJS.ErrnoException).code = 'OFFER_NOT_ACTIVE'
      throw err
    }

    // Requirement 9.17: private offer requires correct accessCode
    if (offer.visibility === OfferVisibility.PRIVADA) {
      if (!accessCode || accessCode !== offer.accessCode) {
        const err = new Error('A valid Access_Code is required to accept this private Offer')
        ;(err as NodeJS.ErrnoException).code = 'INVALID_ACCESS_CODE'
        throw err
      }
    }

    // Determine buyer wallet:
    // - If buyer is a Business_Owner (has businesses), use Business Wallet
    // - Otherwise use User Wallet
    // Requirements 9.5, 9.6
    const buyerBusinesses = await this.prisma.business.findMany({
      where: { ownerId: buyerUserId },
      include: { wallet: true },
    })

    let buyerWallet
    if (buyerBusinesses.length > 0 && buyerBusinesses[0].wallet) {
      // Business_Owner: use Business Wallet
      buyerWallet = buyerBusinesses[0].wallet
    } else {
      // Regular User: use User Wallet
      buyerWallet = await this.prisma.wallet.findUnique({ where: { userId: buyerUserId } })
    }

    if (!buyerWallet) {
      const err = new Error('Buyer wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    // Get seller's User Wallet
    const sellerWallet = await this.prisma.wallet.findUnique({
      where: { userId: offer.sellerId },
    })

    if (!sellerWallet) {
      const err = new Error('Seller wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    const coinAmount = new Prisma.Decimal(offer.coinAmount)
    const diamondPricePerCoin = new Prisma.Decimal(offer.diamondPricePerCoin)
    const totalDiamonds = coinAmount.mul(diamondPricePerCoin)

    // Check buyer has enough diamonds (Req 9.8, 9.9)
    if (new Prisma.Decimal(buyerWallet.diamondBalance).lt(totalDiamonds)) {
      const err = new Error('Insufficient diamond balance to accept this Offer')
      ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
      throw err
    }

    // Execute atomically
    const result = await this.prisma.$transaction(async (prisma) => {
      // Lock all involved wallets (order by id to prevent deadlocks)
      const walletIds = [buyerWallet!.id, sellerWallet.id].sort()
      await prisma.$queryRaw`
        SELECT * FROM "Wallet" WHERE id = ANY(${walletIds}::text[]) ORDER BY id FOR UPDATE
      `

      // Re-read buyer diamond balance inside transaction
      const lockedBuyer = await prisma.wallet.findUnique({
        where: { id: buyerWallet!.id },
        select: { diamondBalance: true },
      })
      if (!lockedBuyer) throw new Error('Buyer wallet not found')

      if (new Prisma.Decimal(lockedBuyer.diamondBalance).lt(totalDiamonds)) {
        const err = new Error('Insufficient diamond balance to accept this Offer')
        ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
        throw err
      }

      // Transfer Coins from reserved (offer) to buyer wallet (Req 9.5, 9.6)
      await prisma.wallet.update({
        where: { id: buyerWallet!.id },
        data: { coinBalance: { increment: coinAmount } },
      })

      // Deduct Diamonds from buyer wallet
      await prisma.wallet.update({
        where: { id: buyerWallet!.id },
        data: { diamondBalance: { decrement: totalDiamonds } },
      })

      // Transfer Diamonds to seller wallet
      await prisma.wallet.update({
        where: { id: sellerWallet.id },
        data: { diamondBalance: { increment: totalDiamonds } },
      })

      // Mark offer as COMPLETED
      await prisma.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.COMPLETED },
      })

      // Create MARKETPLACE_SALE transaction for seller (Req 9.7)
      const saleTx = await prisma.transaction.create({
        data: {
          type: TransactionType.MARKETPLACE_SALE,
          fromWalletId: buyerWallet!.id,
          toWalletId: sellerWallet.id,
          coinAmount: coinAmount,
          diamondAmount: totalDiamonds,
          metadata: {
            offerId,
            sellerId: offer.sellerId,
            buyerUserId,
            coinAmount: coinAmount.toNumber(),
            diamondPricePerCoin: diamondPricePerCoin.toNumber(),
            totalDiamonds: totalDiamonds.toNumber(),
          },
        },
      })

      // Create MARKETPLACE_PURCHASE transaction for buyer (Req 9.7)
      const purchaseTx = await prisma.transaction.create({
        data: {
          type: TransactionType.MARKETPLACE_PURCHASE,
          fromWalletId: buyerWallet!.id,
          toWalletId: sellerWallet.id,
          coinAmount: coinAmount,
          diamondAmount: totalDiamonds,
          metadata: {
            offerId,
            sellerId: offer.sellerId,
            buyerUserId,
            coinAmount: coinAmount.toNumber(),
            diamondPricePerCoin: diamondPricePerCoin.toNumber(),
            totalDiamonds: totalDiamonds.toNumber(),
          },
        },
      })

      return { saleTx, purchaseTx }
    })

    // Create notifications for buyer and seller (Req 11.2)
    await Promise.all([
      this.prisma.notification.create({
        data: {
          userId: offer.sellerId,
          type: 'MARKETPLACE_COMPLETED',
          payload: {
            role: 'seller',
            offerId,
            coins: coinAmount.toNumber(),
            diamonds: totalDiamonds.toNumber(),
            buyerUserId,
          },
        },
      }),
      this.prisma.notification.create({
        data: {
          userId: buyerUserId,
          type: 'MARKETPLACE_COMPLETED',
          payload: {
            role: 'buyer',
            offerId,
            coins: coinAmount.toNumber(),
            diamonds: totalDiamonds.toNumber(),
            sellerId: offer.sellerId,
          },
        },
      }),
    ])

    return result
  }

  // ─── cancelOffer ────────────────────────────────────────────────────────────

  /**
   * Cancel an active Offer (seller only).
   * Returns reserved Coins to the seller's User Wallet.
   * Requirements: 9.10, 9.11
   */
  async cancelOffer(userId: string, offerId: string): Promise<void> {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } })

    if (!offer) {
      const err = new Error('Offer not found')
      ;(err as NodeJS.ErrnoException).code = 'OFFER_NOT_FOUND'
      throw err
    }

    if (offer.sellerId !== userId) {
      const err = new Error('Only the seller can cancel this Offer')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    if (offer.status !== OfferStatus.ACTIVE) {
      const err = new Error('Only active Offers can be cancelled')
      ;(err as NodeJS.ErrnoException).code = 'OFFER_NOT_ACTIVE'
      throw err
    }

    const sellerWallet = await this.prisma.wallet.findUnique({ where: { userId } })
    if (!sellerWallet) {
      const err = new Error('Seller wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    const coinAmount = new Prisma.Decimal(offer.coinAmount)

    // Execute atomically
    await this.prisma.$transaction(async (prisma) => {
      // Lock seller wallet
      await prisma.$queryRaw`
        SELECT * FROM "Wallet" WHERE id = ${sellerWallet.id} FOR UPDATE
      `

      // Return reserved Coins to seller wallet (Req 9.10)
      await prisma.wallet.update({
        where: { id: sellerWallet.id },
        data: { coinBalance: { increment: coinAmount } },
      })

      // Mark offer as CANCELLED
      await prisma.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.CANCELLED },
      })

      // Create OFFER_CANCEL_RETURN transaction (Req 9.11)
      await prisma.transaction.create({
        data: {
          type: TransactionType.OFFER_CANCEL_RETURN,
          toWalletId: sellerWallet.id,
          coinAmount: coinAmount,
          metadata: {
            offerId,
            sellerId: userId,
            coinsReturned: coinAmount.toNumber(),
          },
        },
      })
    })
  }
}
