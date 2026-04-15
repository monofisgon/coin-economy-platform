import { PrismaClient } from '@prisma/client'
import type { Follow, Product, Offer } from '@prisma/client'

export interface CreateFollowDTO {
  followedUserId?: string
  followedBizId?: string
}

export interface FeedItem {
  type: 'PRODUCT' | 'OFFER'
  id: string
  createdAt: Date
  data: Record<string, unknown>
}

export class FollowService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Follow a user or business.
   * Requirements: 18.1, 18.3, 18.7
   */
  async createFollow(followerId: string, dto: CreateFollowDTO): Promise<Follow> {
    if (!dto.followedUserId && !dto.followedBizId) {
      const err = new Error('Must provide followedUserId or followedBizId')
      ;(err as NodeJS.ErrnoException).code = 'VALIDATION_ERROR'
      throw err
    }

    if (dto.followedUserId && dto.followedBizId) {
      const err = new Error('Provide only one of followedUserId or followedBizId')
      ;(err as NodeJS.ErrnoException).code = 'VALIDATION_ERROR'
      throw err
    }

    // Check for duplicate follow
    const existing = await this.prisma.follow.findFirst({
      where: {
        followerId,
        ...(dto.followedUserId ? { followedUserId: dto.followedUserId } : {}),
        ...(dto.followedBizId ? { followedBizId: dto.followedBizId } : {}),
      },
    })

    if (existing) {
      const err = new Error('Follow relationship already exists')
      ;(err as NodeJS.ErrnoException).code = 'FOLLOW_ALREADY_EXISTS'
      throw err
    }

    return this.prisma.follow.create({
      data: {
        followerId,
        followedUserId: dto.followedUserId ?? null,
        followedBizId: dto.followedBizId ?? null,
      },
    })
  }

  /**
   * Unfollow a user or business.
   * Requirements: 18.2, 18.8
   */
  async deleteFollow(followerId: string, followId: string): Promise<void> {
    const follow = await this.prisma.follow.findUnique({ where: { id: followId } })

    if (!follow) {
      const err = new Error('Follow relationship not found')
      ;(err as NodeJS.ErrnoException).code = 'FOLLOW_NOT_FOUND'
      throw err
    }

    if (follow.followerId !== followerId) {
      const err = new Error('You can only remove your own follows')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    await this.prisma.follow.delete({ where: { id: followId } })
  }

  /**
   * Get the feed for a user: recent Products from followed Businesses
   * and recent Offers from followed Users, ordered by createdAt DESC.
   * Requirements: 17.2, 17.3, 17.4, 18.5, 18.6
   */
  async getFeed(userId: string): Promise<{ items: FeedItem[]; message?: string }> {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
    })

    if (follows.length === 0) {
      return {
        items: [],
        message: 'No sigues a ninguna cuenta todavía. ¡Sigue negocios y usuarios para ver su contenido aquí!',
      }
    }

    const followedBizIds = follows
      .filter((f) => f.followedBizId !== null)
      .map((f) => f.followedBizId as string)

    const followedUserIds = follows
      .filter((f) => f.followedUserId !== null)
      .map((f) => f.followedUserId as string)

    // Fetch recent products from followed businesses
    const products: Product[] = followedBizIds.length > 0
      ? await this.prisma.product.findMany({
          where: {
            businessId: { in: followedBizIds },
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : []

    // Fetch recent active offers from followed users
    const offers: Offer[] = followedUserIds.length > 0
      ? await this.prisma.offer.findMany({
          where: {
            sellerId: { in: followedUserIds },
            status: 'ACTIVE',
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : []

    // Merge and sort by createdAt DESC
    const items: FeedItem[] = [
      ...products.map((p) => ({
        type: 'PRODUCT' as const,
        id: p.id,
        createdAt: p.createdAt,
        data: {
          id: p.id,
          name: p.name,
          description: p.description,
          imageUrl: p.imageUrl,
          coinPrice: p.coinPrice,
          businessId: p.businessId,
        },
      })),
      ...offers.map((o) => ({
        type: 'OFFER' as const,
        id: o.id,
        createdAt: o.createdAt,
        data: {
          id: o.id,
          sellerId: o.sellerId,
          coinAmount: o.coinAmount,
          diamondPricePerCoin: o.diamondPricePerCoin,
          visibility: o.visibility,
          status: o.status,
        },
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return { items }
  }

  /**
   * Get follower/following counts for a user.
   */
  async getUserCounts(userId: string): Promise<{ followers: number; following: number }> {
    const [followers, following] = await Promise.all([
      this.prisma.follow.count({ where: { followedUserId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ])
    return { followers, following }
  }
}
