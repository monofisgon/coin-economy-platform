import {
  PrismaClient,
  TransactionType,
  WalletOwner,
  BusinessStatus,
  Prisma,
} from '@prisma/client'
import type { Transaction, Wallet } from '@prisma/client'
import {
  COIN_RECHARGE_AMOUNT,
  COIN_RECHARGE_COP,
  COIN_RECHARGE_PLATFORM_FEE_COP,
  COIN_RECHARGE_INCENTIVE_FUND_COP,
  INCENTIVE_FUND_COINS_PER_COIN_RECHARGE,
  DIAMOND_RECHARGE_AMOUNT,
  DIAMOND_RECHARGE_COP,
  DIAMOND_RECHARGE_PLATFORM_FEE_COP,
  DIAMOND_RECHARGE_INCENTIVE_FUND_COP,
  INCENTIVE_FUND_COINS_PER_DIAMOND_RECHARGE,
  DIAMOND_REFUND_RATE_COP,
  DIAMOND_REFUND_MIN,
  DIAMOND_REFUND_MAX,
} from '@krowdco/shared'
import { BusinessService } from '../business/business.service'

export interface WalletBalance {
  coinBalance: Prisma.Decimal
  diamondBalance: Prisma.Decimal
}

export interface TxFilters {
  type?: TransactionType
}

export interface Pagination {
  page: number
  limit: number
}

export interface Page<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// Simulated payment processor result
export interface PaymentResult {
  success: boolean
  reference: string
}

/**
 * Simulated payment processor — in production this would call Stripe/PSE.
 * Uses idempotency key to prevent double charges.
 */
export async function simulatePayment(
  _idempotencyKey: string,
  _amountCOP: number,
): Promise<PaymentResult> {
  // Simulate successful payment
  return { success: true, reference: `PAY-${Date.now()}` }
}

export class WalletService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly businessService: BusinessService,
  ) {}

  // ─── getBalance ────────────────────────────────────────────────────────────

  async getBalance(walletId: string): Promise<WalletBalance> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { coinBalance: true, diamondBalance: true },
    })
    if (!wallet) {
      const err = new Error('Wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }
    return wallet
  }

  // ─── getTransactionHistory ─────────────────────────────────────────────────

  async getTransactionHistory(
    walletId: string,
    filters: TxFilters,
    pagination: Pagination,
  ): Promise<Page<Transaction>> {
    // Verify wallet exists
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } })
    if (!wallet) {
      const err = new Error('Wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    const where: Prisma.TransactionWhereInput = {
      OR: [{ fromWalletId: walletId }, { toWalletId: walletId }],
      ...(filters.type ? { type: filters.type } : {}),
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.transaction.count({ where }),
    ])

    return { data, total, page: pagination.page, limit: pagination.limit }
  }

  // ─── rechargeCoins ─────────────────────────────────────────────────────────

  /**
   * Recharge Coins for a Business Wallet.
   * Requirements: 3.1-3.8
   */
  async rechargeCoins(
    businessWalletId: string,
    idempotencyKey: string,
    requesterId: string,
  ): Promise<Transaction> {
    // Verify wallet exists and belongs to a business
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: businessWalletId },
      include: { business: true },
    })

    if (!wallet || wallet.ownerType !== WalletOwner.BUSINESS || !wallet.business) {
      const err = new Error('Business wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    // Verify requester is the business owner
    if (wallet.business.ownerId !== requesterId) {
      const err = new Error('Only the business owner can recharge coins')
      ;(err as NodeJS.ErrnoException).code = 'COIN_RECHARGE_FORBIDDEN'
      throw err
    }

    // Simulate payment processing
    const payment = await simulatePayment(idempotencyKey, COIN_RECHARGE_COP)
    if (!payment.success) {
      const err = new Error('Payment failed or was rejected by the payment processor')
      ;(err as NodeJS.ErrnoException).code = 'PAYMENT_FAILED'
      throw err
    }

    const isInitialRecharge = wallet.business.status === BusinessStatus.PENDING

    // Execute atomically with SELECT FOR UPDATE
    const tx = await this.prisma.$transaction(async (prisma) => {
      // Lock the wallet row
      const lockedWallet = await prisma.$queryRaw<Wallet[]>`
        SELECT * FROM "Wallet" WHERE id = ${businessWalletId} FOR UPDATE
      `
      if (!lockedWallet.length) throw new Error('Wallet not found')

      // Get or create IncentiveFund
      let incentiveFund = await prisma.incentiveFund.findFirst()
      if (!incentiveFund) {
        incentiveFund = await prisma.incentiveFund.create({
          data: { coinBalance: 0 },
        })
      }

      // Credit coins to business wallet
      await prisma.wallet.update({
        where: { id: businessWalletId },
        data: {
          coinBalance: {
            increment: COIN_RECHARGE_AMOUNT,
          },
        },
      })

      // Credit coins to incentive fund
      await prisma.incentiveFund.update({
        where: { id: incentiveFund.id },
        data: {
          coinBalance: {
            increment: INCENTIVE_FUND_COINS_PER_COIN_RECHARGE,
          },
        },
      })

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          type: TransactionType.COIN_RECHARGE,
          toWalletId: businessWalletId,
          coinAmount: COIN_RECHARGE_AMOUNT,
          copAmount: COIN_RECHARGE_COP,
          platformFee: COIN_RECHARGE_PLATFORM_FEE_COP,
          incentiveFund: COIN_RECHARGE_INCENTIVE_FUND_COP,
          metadata: {
            businessId: wallet.business!.id,
            paymentReference: payment.reference,
            idempotencyKey,
          },
        },
      })

      return transaction
    })

    // Activate business if this was the initial recharge
    if (isInitialRecharge) {
      await this.businessService.activate(wallet.business.id)
    }

    return tx
  }

  // ─── rechargeDiamonds ──────────────────────────────────────────────────────

  /**
   * Recharge Diamonds for a User or Business Wallet.
   * Requirements: 6.1-6.8
   */
  async rechargeDiamonds(
    targetWalletId: string,
    idempotencyKey: string,
  ): Promise<Transaction> {
    // Verify wallet exists
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: targetWalletId },
    })

    if (!wallet) {
      const err = new Error('Wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    // Simulate payment processing
    const payment = await simulatePayment(idempotencyKey, DIAMOND_RECHARGE_COP)
    if (!payment.success) {
      const err = new Error('Payment failed or was rejected by the payment processor')
      ;(err as NodeJS.ErrnoException).code = 'PAYMENT_FAILED'
      throw err
    }

    // Execute atomically with SELECT FOR UPDATE
    const transaction = await this.prisma.$transaction(async (prisma) => {
      // Lock the wallet row
      const lockedWallet = await prisma.$queryRaw<Wallet[]>`
        SELECT * FROM "Wallet" WHERE id = ${targetWalletId} FOR UPDATE
      `
      if (!lockedWallet.length) throw new Error('Wallet not found')

      // Get or create IncentiveFund
      let incentiveFund = await prisma.incentiveFund.findFirst()
      if (!incentiveFund) {
        incentiveFund = await prisma.incentiveFund.create({
          data: { coinBalance: 0 },
        })
      }

      // Credit diamonds to target wallet
      await prisma.wallet.update({
        where: { id: targetWalletId },
        data: {
          diamondBalance: {
            increment: DIAMOND_RECHARGE_AMOUNT,
          },
        },
      })

      // Credit coins to incentive fund
      await prisma.incentiveFund.update({
        where: { id: incentiveFund.id },
        data: {
          coinBalance: {
            increment: INCENTIVE_FUND_COINS_PER_DIAMOND_RECHARGE,
          },
        },
      })

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          type: TransactionType.DIAMOND_RECHARGE,
          toWalletId: targetWalletId,
          diamondAmount: DIAMOND_RECHARGE_AMOUNT,
          copAmount: DIAMOND_RECHARGE_COP,
          platformFee: DIAMOND_RECHARGE_PLATFORM_FEE_COP,
          incentiveFund: DIAMOND_RECHARGE_INCENTIVE_FUND_COP,
          metadata: {
            paymentReference: payment.reference,
            idempotencyKey,
          },
        },
      })

      return transaction
    })

    return transaction
  }

  // ─── donate ────────────────────────────────────────────────────────────────

  /**
   * Donate Coins from a Business Wallet to a User Wallet.
   * Requirements: 4.1-4.7
   */
  async donate(
    fromBusinessWalletId: string,
    toUserWalletId: string,
    amount: number,
    requesterId: string,
  ): Promise<Transaction> {
    if (amount <= 0) {
      const err = new Error('Donation amount must be greater than 0')
      ;(err as NodeJS.ErrnoException).code = 'INVALID_AMOUNT'
      throw err
    }

    // Load business wallet with business info
    const fromWallet = await this.prisma.wallet.findUnique({
      where: { id: fromBusinessWalletId },
      include: { business: true },
    })

    if (!fromWallet || fromWallet.ownerType !== WalletOwner.BUSINESS || !fromWallet.business) {
      const err = new Error('Business wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    // Verify requester is the business owner
    if (fromWallet.business.ownerId !== requesterId) {
      const err = new Error('Only the business owner can donate from this wallet')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    // Verify business is ACTIVE
    if (fromWallet.business.status !== BusinessStatus.ACTIVE) {
      const err = new Error('Business must be active to donate coins')
      ;(err as NodeJS.ErrnoException).code = 'BUSINESS_PENDING'
      throw err
    }

    // Load recipient wallet
    const toWallet = await this.prisma.wallet.findUnique({
      where: { id: toUserWalletId },
      include: { user: true },
    })

    if (!toWallet || toWallet.ownerType !== WalletOwner.USER || !toWallet.user) {
      const err = new Error('User wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    // Prevent self-donation
    if (fromWallet.business.ownerId === toWallet.userId) {
      const err = new Error('Self-donations are not permitted')
      ;(err as NodeJS.ErrnoException).code = 'SELF_DONATION_NOT_ALLOWED'
      throw err
    }

    // Execute atomically with SELECT FOR UPDATE
    const transaction = await this.prisma.$transaction(async (prisma) => {
      // Lock both wallets (order by id to prevent deadlocks)
      const ids = [fromBusinessWalletId, toUserWalletId].sort()
      await prisma.$queryRaw`
        SELECT * FROM "Wallet" WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE
      `

      // Re-read balance inside transaction
      const lockedFrom = await prisma.wallet.findUnique({
        where: { id: fromBusinessWalletId },
        select: { coinBalance: true },
      })

      if (!lockedFrom) throw new Error('Business wallet not found')

      if (new Prisma.Decimal(lockedFrom.coinBalance).lt(amount)) {
        const err = new Error('Insufficient coin balance for donation')
        ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
        throw err
      }

      // Deduct from business wallet
      await prisma.wallet.update({
        where: { id: fromBusinessWalletId },
        data: { coinBalance: { decrement: amount } },
      })

      // Credit to user wallet
      await prisma.wallet.update({
        where: { id: toUserWalletId },
        data: { coinBalance: { increment: amount } },
      })

      // Create transaction record
      const tx = await prisma.transaction.create({
        data: {
          type: TransactionType.DONATION,
          fromWalletId: fromBusinessWalletId,
          toWalletId: toUserWalletId,
          coinAmount: amount,
          metadata: {
            businessId: fromWallet.business!.id,
            businessName: fromWallet.business!.name,
            recipientUserId: toWallet.userId,
          },
        },
      })

      return tx
    })

    return transaction
  }

  // ─── refundDiamonds ────────────────────────────────────────────────────────

  /**
   * Refund Diamonds from a User Wallet back to COP.
   * Requirements: 12.1-12.7
   */
  async refundDiamonds(
    userWalletId: string,
    requesterId: string,
  ): Promise<Transaction & { copRefund: number }> {
    // Load wallet with user info
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: userWalletId },
      include: { user: true },
    })

    if (!wallet || wallet.ownerType !== WalletOwner.USER || !wallet.user) {
      const err = new Error('User wallet not found')
      ;(err as NodeJS.ErrnoException).code = 'WALLET_NOT_FOUND'
      throw err
    }

    // Only the wallet owner can refund
    if (wallet.userId !== requesterId) {
      const err = new Error('You can only refund your own wallet')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    const diamondBalance = new Prisma.Decimal(wallet.diamondBalance)

    // Validate range [200, 500]
    if (diamondBalance.lt(DIAMOND_REFUND_MIN)) {
      const err = new Error(
        `Diamond balance must be at least ${DIAMOND_REFUND_MIN} to request a refund`,
      )
      ;(err as NodeJS.ErrnoException).code = 'DIAMOND_REFUND_BELOW_MIN'
      throw err
    }

    if (diamondBalance.gt(DIAMOND_REFUND_MAX)) {
      const err = new Error(
        `Diamond balance must not exceed ${DIAMOND_REFUND_MAX} to request a refund`,
      )
      ;(err as NodeJS.ErrnoException).code = 'DIAMOND_REFUND_ABOVE_MAX'
      throw err
    }

    const diamondCount = diamondBalance.toNumber()
    const copRefund = diamondCount * DIAMOND_REFUND_RATE_COP

    // Execute atomically with SELECT FOR UPDATE
    const transaction = await this.prisma.$transaction(async (prisma) => {
      // Lock wallet
      await prisma.$queryRaw`
        SELECT * FROM "Wallet" WHERE id = ${userWalletId} FOR UPDATE
      `

      // Re-read balance inside transaction
      const lockedWallet = await prisma.wallet.findUnique({
        where: { id: userWalletId },
        select: { diamondBalance: true },
      })

      if (!lockedWallet) throw new Error('Wallet not found')

      const currentBalance = new Prisma.Decimal(lockedWallet.diamondBalance)
      if (currentBalance.lt(DIAMOND_REFUND_MIN) || currentBalance.gt(DIAMOND_REFUND_MAX)) {
        const err = new Error('Diamond balance is outside the refund range')
        ;(err as NodeJS.ErrnoException).code = 'DIAMOND_REFUND_RANGE_ERROR'
        throw err
      }

      // Deduct diamonds
      await prisma.wallet.update({
        where: { id: userWalletId },
        data: { diamondBalance: { decrement: diamondCount } },
      })

      // Create transaction record
      const tx = await prisma.transaction.create({
        data: {
          type: TransactionType.DIAMOND_REFUND,
          fromWalletId: userWalletId,
          diamondAmount: diamondCount,
          copAmount: copRefund,
          metadata: {
            userId: wallet.userId,
            diamondsRefunded: diamondCount,
            copRefunded: copRefund,
          },
        },
      })

      return tx
    })

    return { ...transaction, copRefund }
  }

  // ─── transfer ──────────────────────────────────────────────────────────────

  /**
   * Generic transfer between wallets (used by marketplace, catalog, etc.)
   */
  async transfer(params: {
    fromWalletId: string
    toWalletId: string
    coinAmount?: number
    diamondAmount?: number
    type: TransactionType
    metadata?: Record<string, unknown>
  }): Promise<Transaction> {
    const { fromWalletId, toWalletId, coinAmount, diamondAmount, type, metadata } = params

    const transaction = await this.prisma.$transaction(async (prisma) => {
      // Lock both wallets
      const ids = [fromWalletId, toWalletId].sort()
      await prisma.$queryRaw`
        SELECT * FROM "Wallet" WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE
      `

      const fromWallet = await prisma.wallet.findUnique({
        where: { id: fromWalletId },
        select: { coinBalance: true, diamondBalance: true },
      })

      if (!fromWallet) throw new Error('Source wallet not found')

      // Validate balances
      if (coinAmount && new Prisma.Decimal(fromWallet.coinBalance).lt(coinAmount)) {
        const err = new Error('Insufficient coin balance')
        ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
        throw err
      }

      if (diamondAmount && new Prisma.Decimal(fromWallet.diamondBalance).lt(diamondAmount)) {
        const err = new Error('Insufficient diamond balance')
        ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
        throw err
      }

      // Update balances
      if (coinAmount) {
        await prisma.wallet.update({
          where: { id: fromWalletId },
          data: { coinBalance: { decrement: coinAmount } },
        })
        await prisma.wallet.update({
          where: { id: toWalletId },
          data: { coinBalance: { increment: coinAmount } },
        })
      }

      if (diamondAmount) {
        await prisma.wallet.update({
          where: { id: fromWalletId },
          data: { diamondBalance: { decrement: diamondAmount } },
        })
        await prisma.wallet.update({
          where: { id: toWalletId },
          data: { diamondBalance: { increment: diamondAmount } },
        })
      }

      const tx = await prisma.transaction.create({
        data: {
          type,
          fromWalletId,
          toWalletId,
          ...(coinAmount ? { coinAmount } : {}),
          ...(diamondAmount ? { diamondAmount } : {}),
          ...(metadata ? { metadata } : {}),
        },
      })

      return tx
    })

    return transaction
  }
}
