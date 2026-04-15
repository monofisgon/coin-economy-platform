import { PrismaClient, BusinessStatus, TransactionType } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { ACTIVE_BUSINESS_THRESHOLD } from '@coin-economy/shared'

export type RankingType =
  | 'USER_COINS_SOLD'
  | 'USER_COINS_BALANCE'
  | 'USER_COINS_REDEEMED'
  | 'BUSINESS_COINS_DONATED'
  | 'BUSINESS_COINS_PURCHASED'
  | 'BUSINESS_COINS_REDEEMED_ON'

export interface RankingEntry {
  position: number
  entityId: string
  entityType: 'USER' | 'BUSINESS'
  metricValue: number
  name: string
}

export interface RankingTable {
  type: RankingType
  year: number
  weekNumber: number
  entries: RankingEntry[]
  available: boolean
  message?: string
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export class RankingService {
  constructor(private readonly prisma: PrismaClient) {}

  async isRankingActive(): Promise<boolean> {
    const count = await this.prisma.business.count({
      where: { status: BusinessStatus.ACTIVE },
    })
    return count >= ACTIVE_BUSINESS_THRESHOLD
  }

  /**
   * Get rankings for a given type and year.
   * Returns empty if < 500 active businesses.
   * Requirements: 15.1, 15.2, 15.3, 15.6, 15.7
   */
  async getRankings(type: RankingType, year?: number): Promise<RankingTable> {
    const active = await this.isRankingActive()
    const targetYear = year ?? new Date().getFullYear()

    if (!active) {
      return {
        type,
        year: targetYear,
        weekNumber: getWeekNumber(new Date()),
        entries: [],
        available: false,
        message: `Los Rankings estarán disponibles cuando la plataforma alcance ${ACTIVE_BUSINESS_THRESHOLD} negocios activos.`,
      }
    }

    // Get the latest snapshot for this type and year
    const snapshot = await this.prisma.rankingSnapshot.findFirst({
      where: { type, year: targetYear },
      orderBy: { weekNumber: 'desc' },
    })

    if (!snapshot) {
      return {
        type,
        year: targetYear,
        weekNumber: getWeekNumber(new Date()),
        entries: [],
        available: true,
        message: 'No hay datos de ranking disponibles aún para este período.',
      }
    }

    return {
      type,
      year: targetYear,
      weekNumber: snapshot.weekNumber,
      entries: snapshot.entries as unknown as RankingEntry[],
      available: true,
    }
  }

  /**
   * Compute weekly rankings for all 6 types and persist as RankingSnapshot.
   * Requirements: 15.1, 15.2, 15.4, 15.5
   */
  async computeWeeklyRankings(): Promise<void> {
    const now = new Date()
    const year = now.getFullYear()
    const weekNumber = getWeekNumber(now)

    // Week start (7 days ago)
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - 7)

    await Promise.all([
      this._computeUserCoinsSold(year, weekNumber, weekStart),
      this._computeUserCoinsBalance(year, weekNumber),
      this._computeUserCoinsRedeemed(year, weekNumber, weekStart),
      this._computeBusinessCoinsDonated(year, weekNumber, weekStart),
      this._computeBusinessCoinsPurchased(year, weekNumber, weekStart),
      this._computeBusinessCoinsRedeemedOn(year, weekNumber, weekStart),
    ])
  }

  private async _computeUserCoinsSold(year: number, weekNumber: number, since: Date): Promise<void> {
    // Top 10 users who sold the most Coins in Marketplace
    const results = await this.prisma.$queryRaw<Array<{ sellerId: string; total: number }>>`
      SELECT o."sellerId", COALESCE(SUM(t."coinAmount"), 0)::float AS total
      FROM "Transaction" t
      JOIN "Offer" o ON (t.metadata->>'offerId') = o.id
      WHERE t.type = ${TransactionType.MARKETPLACE_SALE}
        AND t."createdAt" >= ${since}
      GROUP BY o."sellerId"
      ORDER BY total DESC
      LIMIT 10
    `

    const entries = await this._enrichUserEntries(results.map((r) => ({ id: r.sellerId, value: r.total })))
    await this._saveSnapshot('USER_COINS_SOLD', year, weekNumber, entries)
  }

  private async _computeUserCoinsBalance(year: number, weekNumber: number): Promise<void> {
    // Top 10 users with highest Coin balance
    const wallets = await this.prisma.wallet.findMany({
      where: { ownerType: 'USER', userId: { not: null } },
      orderBy: { coinBalance: 'desc' },
      take: 10,
      select: { userId: true, coinBalance: true },
    })

    const entries = await this._enrichUserEntries(
      wallets.map((w) => ({ id: w.userId!, value: Number(w.coinBalance) })),
    )
    await this._saveSnapshot('USER_COINS_BALANCE', year, weekNumber, entries)
  }

  private async _computeUserCoinsRedeemed(year: number, weekNumber: number, since: Date): Promise<void> {
    // Top 10 users who redeemed the most Coins on products
    const results = await this.prisma.$queryRaw<Array<{ fromWalletId: string; total: number }>>`
      SELECT t."fromWalletId", COALESCE(SUM(t."coinAmount"), 0)::float AS total
      FROM "Transaction" t
      WHERE t.type = ${TransactionType.PRODUCT_PURCHASE}
        AND t."createdAt" >= ${since}
      GROUP BY t."fromWalletId"
      ORDER BY total DESC
      LIMIT 10
    `

    const walletIds = results.map((r) => r.fromWalletId)
    const wallets = await this.prisma.wallet.findMany({
      where: { id: { in: walletIds }, userId: { not: null } },
      select: { id: true, userId: true },
    })
    const walletToUser = new Map(wallets.map((w) => [w.id, w.userId!]))

    const entries = await this._enrichUserEntries(
      results
        .filter((r) => walletToUser.has(r.fromWalletId))
        .map((r) => ({ id: walletToUser.get(r.fromWalletId)!, value: r.total })),
    )
    await this._saveSnapshot('USER_COINS_REDEEMED', year, weekNumber, entries)
  }

  private async _computeBusinessCoinsDonated(year: number, weekNumber: number, since: Date): Promise<void> {
    // Top 10 businesses that donated the most Coins
    const results = await this.prisma.$queryRaw<Array<{ fromWalletId: string; total: number }>>`
      SELECT t."fromWalletId", COALESCE(SUM(t."coinAmount"), 0)::float AS total
      FROM "Transaction" t
      WHERE t.type = ${TransactionType.DONATION}
        AND t."createdAt" >= ${since}
      GROUP BY t."fromWalletId"
      ORDER BY total DESC
      LIMIT 10
    `

    const walletIds = results.map((r) => r.fromWalletId)
    const wallets = await this.prisma.wallet.findMany({
      where: { id: { in: walletIds }, businessId: { not: null } },
      select: { id: true, businessId: true },
    })
    const walletToBiz = new Map(wallets.map((w) => [w.id, w.businessId!]))

    const entries = await this._enrichBusinessEntries(
      results
        .filter((r) => walletToBiz.has(r.fromWalletId))
        .map((r) => ({ id: walletToBiz.get(r.fromWalletId)!, value: r.total })),
    )
    await this._saveSnapshot('BUSINESS_COINS_DONATED', year, weekNumber, entries)
  }

  private async _computeBusinessCoinsPurchased(year: number, weekNumber: number, since: Date): Promise<void> {
    // Top 10 businesses that purchased the most Coins in Marketplace
    const results = await this.prisma.$queryRaw<Array<{ toWalletId: string; total: number }>>`
      SELECT t."toWalletId", COALESCE(SUM(t."coinAmount"), 0)::float AS total
      FROM "Transaction" t
      WHERE t.type = ${TransactionType.MARKETPLACE_PURCHASE}
        AND t."createdAt" >= ${since}
      GROUP BY t."toWalletId"
      ORDER BY total DESC
      LIMIT 10
    `

    const walletIds = results.map((r) => r.toWalletId)
    const wallets = await this.prisma.wallet.findMany({
      where: { id: { in: walletIds }, businessId: { not: null } },
      select: { id: true, businessId: true },
    })
    const walletToBiz = new Map(wallets.map((w) => [w.id, w.businessId!]))

    const entries = await this._enrichBusinessEntries(
      results
        .filter((r) => walletToBiz.has(r.toWalletId))
        .map((r) => ({ id: walletToBiz.get(r.toWalletId)!, value: r.total })),
    )
    await this._saveSnapshot('BUSINESS_COINS_PURCHASED', year, weekNumber, entries)
  }

  private async _computeBusinessCoinsRedeemedOn(year: number, weekNumber: number, since: Date): Promise<void> {
    // Top 10 businesses whose products users redeemed the most Coins on
    const results = await this.prisma.$queryRaw<Array<{ toWalletId: string; total: number }>>`
      SELECT t."toWalletId", COALESCE(SUM(t."coinAmount"), 0)::float AS total
      FROM "Transaction" t
      WHERE t.type = ${TransactionType.PRODUCT_PURCHASE}
        AND t."createdAt" >= ${since}
      GROUP BY t."toWalletId"
      ORDER BY total DESC
      LIMIT 10
    `

    const walletIds = results.map((r) => r.toWalletId)
    const wallets = await this.prisma.wallet.findMany({
      where: { id: { in: walletIds }, businessId: { not: null } },
      select: { id: true, businessId: true },
    })
    const walletToBiz = new Map(wallets.map((w) => [w.id, w.businessId!]))

    const entries = await this._enrichBusinessEntries(
      results
        .filter((r) => walletToBiz.has(r.toWalletId))
        .map((r) => ({ id: walletToBiz.get(r.toWalletId)!, value: r.total })),
    )
    await this._saveSnapshot('BUSINESS_COINS_REDEEMED_ON', year, weekNumber, entries)
  }

  private async _enrichUserEntries(
    raw: Array<{ id: string; value: number }>,
  ): Promise<RankingEntry[]> {
    const ids = raw.map((r) => r.id)
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true },
    })
    const nameMap = new Map(users.map((u) => [u.id, u.username]))

    return raw.map((r, idx) => ({
      position: idx + 1,
      entityId: r.id,
      entityType: 'USER' as const,
      metricValue: r.value,
      name: nameMap.get(r.id) ?? r.id,
    }))
  }

  private async _enrichBusinessEntries(
    raw: Array<{ id: string; value: number }>,
  ): Promise<RankingEntry[]> {
    const ids = raw.map((r) => r.id)
    const businesses = await this.prisma.business.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })
    const nameMap = new Map(businesses.map((b) => [b.id, b.name]))

    return raw.map((r, idx) => ({
      position: idx + 1,
      entityId: r.id,
      entityType: 'BUSINESS' as const,
      metricValue: r.value,
      name: nameMap.get(r.id) ?? r.id,
    }))
  }

  private async _saveSnapshot(
    type: RankingType,
    year: number,
    weekNumber: number,
    entries: RankingEntry[],
  ): Promise<void> {
    await this.prisma.rankingSnapshot.create({
      data: {
        type,
        year,
        weekNumber,
        entries: entries as unknown as Prisma.InputJsonValue,
      },
    })
  }

  /**
   * Distribute Incentive Fund coins among top-ranked users and businesses.
   * Only runs if >= 500 active businesses.
   * Requirements: 16.3, 16.4, 16.5, 16.6, 16.7, 16.8
   */
  async distributeIncentiveFund(): Promise<void> {
    const active = await this.isRankingActive()
    if (!active) return

    const incentiveFund = await this.prisma.incentiveFund.findFirst()
    if (!incentiveFund || new Prisma.Decimal(incentiveFund.coinBalance).lte(0)) return

    const totalCoins = new Prisma.Decimal(incentiveFund.coinBalance)
    const year = new Date().getFullYear()

    // Get latest snapshots for all 6 ranking types
    const rankingTypes: RankingType[] = [
      'USER_COINS_SOLD',
      'USER_COINS_BALANCE',
      'USER_COINS_REDEEMED',
      'BUSINESS_COINS_DONATED',
      'BUSINESS_COINS_PURCHASED',
      'BUSINESS_COINS_REDEEMED_ON',
    ]

    const snapshots = await Promise.all(
      rankingTypes.map((type) =>
        this.prisma.rankingSnapshot.findFirst({
          where: { type, year },
          orderBy: { weekNumber: 'desc' },
        }),
      ),
    )

    // Collect all top-1 winners (one per ranking type)
    const winners: Array<{ entityId: string; entityType: 'USER' | 'BUSINESS' }> = []
    for (const snapshot of snapshots) {
      if (!snapshot) continue
      const entries = snapshot.entries as unknown as RankingEntry[]
      if (entries.length > 0) {
        winners.push({ entityId: entries[0].entityId, entityType: entries[0].entityType })
      }
    }

    if (winners.length === 0) return

    // Distribute equally among winners
    const coinsPerWinner = totalCoins.div(winners.length).toDecimalPlaces(4)

    for (const winner of winners) {
      try {
        await this.prisma.$transaction(async (prisma) => {
          // Find winner's wallet
          let wallet
          if (winner.entityType === 'USER') {
            wallet = await prisma.wallet.findUnique({ where: { userId: winner.entityId } })
          } else {
            wallet = await prisma.wallet.findUnique({ where: { businessId: winner.entityId } })
          }

          if (!wallet) throw new Error(`Wallet not found for ${winner.entityId}`)

          // Deduct from incentive fund
          await prisma.incentiveFund.update({
            where: { id: incentiveFund.id },
            data: { coinBalance: { decrement: coinsPerWinner } },
          })

          // Credit to winner wallet
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { coinBalance: { increment: coinsPerWinner } },
          })

          // Create transaction record
          await prisma.transaction.create({
            data: {
              type: TransactionType.INCENTIVE_DISTRIBUTION,
              toWalletId: wallet.id,
              coinAmount: coinsPerWinner,
              metadata: {
                entityId: winner.entityId,
                entityType: winner.entityType,
                year,
              },
            },
          })
        })
      } catch (err) {
        // Requirement 16.8: rollback only this individual transfer, log error, continue
        console.error(`[RankingService] Failed to distribute to ${winner.entityId}:`, err)
      }
    }
  }
}
