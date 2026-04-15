import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { TransactionType, WalletOwner, BusinessStatus } from '@prisma/client'
import { WalletService, simulatePayment } from './wallet.service'
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
} from '@coin-economy/shared'

// ─── Prisma mock helpers ──────────────────────────────────────────────────────

function makeWallet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wallet-1',
    ownerType: WalletOwner.USER,
    userId: 'user-1',
    businessId: null,
    coinBalance: '0',
    diamondBalance: '0',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 'user-1', email: 'user@test.com' },
    business: null,
    ...overrides,
  }
}

function makeBusinessWallet(overrides: Record<string, unknown> = {}) {
  return makeWallet({
    id: 'biz-wallet-1',
    ownerType: WalletOwner.BUSINESS,
    userId: null,
    businessId: 'biz-1',
    user: null,
    business: {
      id: 'biz-1',
      ownerId: 'owner-1',
      name: 'Test Business',
      status: BusinessStatus.ACTIVE,
    },
    ...overrides,
  })
}

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    type: TransactionType.COIN_RECHARGE,
    fromWalletId: null,
    toWalletId: 'wallet-1',
    coinAmount: COIN_RECHARGE_AMOUNT,
    diamondAmount: null,
    copAmount: COIN_RECHARGE_COP,
    platformFee: COIN_RECHARGE_PLATFORM_FEE_COP,
    incentiveFund: COIN_RECHARGE_INCENTIVE_FUND_COP,
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  }
}

function makePrismaMock() {
  return {
    wallet: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    incentiveFund: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    business: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  }
}

function makeBusinessServiceMock() {
  return {
    activate: vi.fn(),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WalletService', () => {
  let prisma: ReturnType<typeof makePrismaMock>
  let businessService: ReturnType<typeof makeBusinessServiceMock>
  let service: WalletService

  beforeEach(() => {
    prisma = makePrismaMock()
    businessService = makeBusinessServiceMock()
    service = new WalletService(prisma as never, businessService as never)
  })

  // ─── getBalance ────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('returns coin and diamond balance for existing wallet', async () => {
      const wallet = { coinBalance: 100, diamondBalance: 50 }
      prisma.wallet.findUnique.mockResolvedValue(wallet)

      const result = await service.getBalance('wallet-1')
      expect(result.coinBalance).toBe(100)
      expect(result.diamondBalance).toBe(50)
    })

    it('throws WALLET_NOT_FOUND for non-existent wallet', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null)

      await expect(service.getBalance('nonexistent')).rejects.toMatchObject({
        code: 'WALLET_NOT_FOUND',
      })
    })
  })

  // ─── getTransactionHistory ─────────────────────────────────────────────────

  describe('getTransactionHistory', () => {
    it('returns paginated transactions for a wallet', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 'wallet-1' })
      const txs = [makeTransaction()]
      prisma.transaction.findMany.mockResolvedValue(txs)
      prisma.transaction.count.mockResolvedValue(1)

      const result = await service.getTransactionHistory('wallet-1', {}, { page: 1, limit: 20 })
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
    })

    it('filters transactions by type', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 'wallet-1' })
      prisma.transaction.findMany.mockResolvedValue([])
      prisma.transaction.count.mockResolvedValue(0)

      await service.getTransactionHistory(
        'wallet-1',
        { type: TransactionType.DONATION },
        { page: 1, limit: 20 },
      )

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: TransactionType.DONATION }),
        }),
      )
    })

    it('throws WALLET_NOT_FOUND for non-existent wallet', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null)

      await expect(
        service.getTransactionHistory('nonexistent', {}, { page: 1, limit: 20 }),
      ).rejects.toMatchObject({ code: 'WALLET_NOT_FOUND' })
    })
  })

  // ─── rechargeCoins ─────────────────────────────────────────────────────────

  describe('rechargeCoins', () => {
    it('credits 233 coins and creates transaction record', async () => {
      const bizWallet = makeBusinessWallet()
      prisma.wallet.findUnique.mockResolvedValue(bizWallet)

      const createdTx = makeTransaction({
        coinAmount: COIN_RECHARGE_AMOUNT,
        copAmount: COIN_RECHARGE_COP,
        platformFee: COIN_RECHARGE_PLATFORM_FEE_COP,
        incentiveFund: COIN_RECHARGE_INCENTIVE_FUND_COP,
      })

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([bizWallet]),
          incentiveFund: {
            findFirst: vi.fn().mockResolvedValue({ id: 'fund-1', coinBalance: 0 }),
            create: vi.fn(),
            update: vi.fn().mockResolvedValue({}),
          },
          wallet: { update: vi.fn().mockResolvedValue({}) },
          transaction: { create: vi.fn().mockResolvedValue(createdTx) },
        }
        return fn(tx)
      })

      businessService.activate.mockResolvedValue({})

      const result = await service.rechargeCoins('biz-wallet-1', 'idem-key-1', 'owner-1')

      expect(result.coinAmount).toBe(COIN_RECHARGE_AMOUNT)
      expect(result.copAmount).toBe(COIN_RECHARGE_COP)
      expect(result.platformFee).toBe(COIN_RECHARGE_PLATFORM_FEE_COP)
      expect(result.incentiveFund).toBe(COIN_RECHARGE_INCENTIVE_FUND_COP)
    })

    it('activates PENDING business on initial recharge', async () => {
      const bizWallet = makeBusinessWallet({
        business: {
          id: 'biz-1',
          ownerId: 'owner-1',
          name: 'Test Business',
          status: BusinessStatus.PENDING,
        },
      })
      prisma.wallet.findUnique.mockResolvedValue(bizWallet)

      const createdTx = makeTransaction()
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([bizWallet]),
          incentiveFund: {
            findFirst: vi.fn().mockResolvedValue({ id: 'fund-1', coinBalance: 0 }),
            update: vi.fn().mockResolvedValue({}),
          },
          wallet: { update: vi.fn().mockResolvedValue({}) },
          transaction: { create: vi.fn().mockResolvedValue(createdTx) },
        }
        return fn(tx)
      })

      businessService.activate.mockResolvedValue({ id: 'biz-1', status: BusinessStatus.ACTIVE })

      await service.rechargeCoins('biz-wallet-1', 'idem-key-1', 'owner-1')

      expect(businessService.activate).toHaveBeenCalledWith('biz-1')
    })

    it('does not activate ACTIVE business on subsequent recharge', async () => {
      const bizWallet = makeBusinessWallet() // status: ACTIVE
      prisma.wallet.findUnique.mockResolvedValue(bizWallet)

      const createdTx = makeTransaction()
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([bizWallet]),
          incentiveFund: {
            findFirst: vi.fn().mockResolvedValue({ id: 'fund-1', coinBalance: 0 }),
            update: vi.fn().mockResolvedValue({}),
          },
          wallet: { update: vi.fn().mockResolvedValue({}) },
          transaction: { create: vi.fn().mockResolvedValue(createdTx) },
        }
        return fn(tx)
      })

      await service.rechargeCoins('biz-wallet-1', 'idem-key-1', 'owner-1')

      expect(businessService.activate).not.toHaveBeenCalled()
    })

    it('throws COIN_RECHARGE_FORBIDDEN when requester is not the owner', async () => {
      const bizWallet = makeBusinessWallet()
      prisma.wallet.findUnique.mockResolvedValue(bizWallet)

      await expect(
        service.rechargeCoins('biz-wallet-1', 'idem-key-1', 'other-user'),
      ).rejects.toMatchObject({ code: 'COIN_RECHARGE_FORBIDDEN' })
    })

    it('throws WALLET_NOT_FOUND for non-business wallet', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null)

      await expect(
        service.rechargeCoins('nonexistent', 'idem-key-1', 'owner-1'),
      ).rejects.toMatchObject({ code: 'WALLET_NOT_FOUND' })
    })
  })

  // ─── rechargeDiamonds ──────────────────────────────────────────────────────

  describe('rechargeDiamonds', () => {
    it('credits 70 diamonds and creates transaction record', async () => {
      const wallet = makeWallet()
      prisma.wallet.findUnique.mockResolvedValue(wallet)

      const createdTx = makeTransaction({
        type: TransactionType.DIAMOND_RECHARGE,
        coinAmount: null,
        diamondAmount: DIAMOND_RECHARGE_AMOUNT,
        copAmount: DIAMOND_RECHARGE_COP,
        platformFee: DIAMOND_RECHARGE_PLATFORM_FEE_COP,
        incentiveFund: DIAMOND_RECHARGE_INCENTIVE_FUND_COP,
      })

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([wallet]),
          incentiveFund: {
            findFirst: vi.fn().mockResolvedValue({ id: 'fund-1', coinBalance: 0 }),
            update: vi.fn().mockResolvedValue({}),
          },
          wallet: { update: vi.fn().mockResolvedValue({}) },
          transaction: { create: vi.fn().mockResolvedValue(createdTx) },
        }
        return fn(tx)
      })

      const result = await service.rechargeDiamonds('wallet-1', 'idem-key-1')

      expect(result.diamondAmount).toBe(DIAMOND_RECHARGE_AMOUNT)
      expect(result.copAmount).toBe(DIAMOND_RECHARGE_COP)
      expect(result.platformFee).toBe(DIAMOND_RECHARGE_PLATFORM_FEE_COP)
      expect(result.incentiveFund).toBe(DIAMOND_RECHARGE_INCENTIVE_FUND_COP)
    })

    it('throws WALLET_NOT_FOUND for non-existent wallet', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null)

      await expect(service.rechargeDiamonds('nonexistent', 'idem-key-1')).rejects.toMatchObject({
        code: 'WALLET_NOT_FOUND',
      })
    })
  })

  // ─── donate ────────────────────────────────────────────────────────────────

  describe('donate', () => {
    it('transfers coins from business wallet to user wallet', async () => {
      const bizWallet = makeBusinessWallet()
      const userWallet = makeWallet()

      prisma.wallet.findUnique
        .mockResolvedValueOnce(bizWallet)
        .mockResolvedValueOnce(userWallet)

      const createdTx = makeTransaction({
        type: TransactionType.DONATION,
        fromWalletId: 'biz-wallet-1',
        toWalletId: 'wallet-1',
        coinAmount: 50,
      })

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          wallet: {
            findUnique: vi.fn().mockResolvedValue({ coinBalance: '1000' }), // sufficient balance
            update: vi.fn().mockResolvedValue({}),
          },
          transaction: { create: vi.fn().mockResolvedValue(createdTx) },
        }
        return fn(tx)
      })

      const result = await service.donate('biz-wallet-1', 'wallet-1', 50, 'owner-1')
      expect(result.type).toBe(TransactionType.DONATION)
      expect(result.coinAmount).toBe(50)
    })

    it('throws INVALID_AMOUNT when amount <= 0', async () => {
      await expect(
        service.donate('biz-wallet-1', 'wallet-1', 0, 'owner-1'),
      ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' })

      await expect(
        service.donate('biz-wallet-1', 'wallet-1', -5, 'owner-1'),
      ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' })
    })

    it('throws SELF_DONATION_NOT_ALLOWED when owner donates to themselves', async () => {
      const bizWallet = makeBusinessWallet()
      // User wallet belongs to the same user as the business owner
      const selfUserWallet = makeWallet({ userId: 'owner-1' })

      prisma.wallet.findUnique
        .mockResolvedValueOnce(bizWallet)
        .mockResolvedValueOnce(selfUserWallet)

      await expect(
        service.donate('biz-wallet-1', 'wallet-1', 50, 'owner-1'),
      ).rejects.toMatchObject({ code: 'SELF_DONATION_NOT_ALLOWED' })
    })

    it('throws BUSINESS_PENDING when business is not active', async () => {
      const pendingBizWallet = makeBusinessWallet({
        business: {
          id: 'biz-1',
          ownerId: 'owner-1',
          name: 'Test Business',
          status: BusinessStatus.PENDING,
        },
      })
      prisma.wallet.findUnique.mockResolvedValueOnce(pendingBizWallet)

      await expect(
        service.donate('biz-wallet-1', 'wallet-1', 50, 'owner-1'),
      ).rejects.toMatchObject({ code: 'BUSINESS_PENDING' })
    })

    it('throws INSUFFICIENT_BALANCE when business has insufficient coins', async () => {
      const bizWallet = makeBusinessWallet()
      const userWallet = makeWallet()

      prisma.wallet.findUnique
        .mockResolvedValueOnce(bizWallet)
        .mockResolvedValueOnce(userWallet)

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          wallet: {
            findUnique: vi.fn().mockResolvedValue({
              coinBalance: '5', // balance < amount (9999)
            }),
            update: vi.fn(),
          },
          transaction: { create: vi.fn() },
        }
        return fn(tx)
      })

      await expect(
        service.donate('biz-wallet-1', 'wallet-1', 9999, 'owner-1'),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
    })
  })

  // ─── refundDiamonds ────────────────────────────────────────────────────────

  describe('refundDiamonds', () => {
    function makeUserWalletWithBalance(balance: number) {
      return makeWallet({
        diamondBalance: balance.toString(),
      })
    }

    it('refunds diamonds and calculates COP correctly', async () => {
      const wallet = makeUserWalletWithBalance(300)
      prisma.wallet.findUnique.mockResolvedValue(wallet)

      const createdTx = makeTransaction({
        type: TransactionType.DIAMOND_REFUND,
        fromWalletId: 'wallet-1',
        diamondAmount: 300,
        copAmount: 300 * DIAMOND_REFUND_RATE_COP,
      })

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          wallet: {
            findUnique: vi.fn().mockResolvedValue({ diamondBalance: '300' }),
            update: vi.fn().mockResolvedValue({}),
          },
          transaction: { create: vi.fn().mockResolvedValue(createdTx) },
        }
        return fn(tx)
      })

      const result = await service.refundDiamonds('wallet-1', 'user-1')
      expect(result.copRefund).toBe(300 * DIAMOND_REFUND_RATE_COP)
    })

    it('throws DIAMOND_REFUND_BELOW_MIN when balance < 200', async () => {
      const wallet = makeUserWalletWithBalance(100)
      prisma.wallet.findUnique.mockResolvedValue(wallet)

      await expect(service.refundDiamonds('wallet-1', 'user-1')).rejects.toMatchObject({
        code: 'DIAMOND_REFUND_BELOW_MIN',
      })
    })

    it('throws DIAMOND_REFUND_ABOVE_MAX when balance > 500', async () => {
      const wallet = makeUserWalletWithBalance(600)
      prisma.wallet.findUnique.mockResolvedValue(wallet)

      await expect(service.refundDiamonds('wallet-1', 'user-1')).rejects.toMatchObject({
        code: 'DIAMOND_REFUND_ABOVE_MAX',
      })
    })

    it('throws FORBIDDEN when requester is not the wallet owner', async () => {
      const wallet = makeUserWalletWithBalance(300)
      prisma.wallet.findUnique.mockResolvedValue(wallet)

      await expect(service.refundDiamonds('wallet-1', 'other-user')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    })
  })
})
