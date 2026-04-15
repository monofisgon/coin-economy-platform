import { PrismaClient, BusinessStatus } from '@prisma/client'

export interface BusinessSearchResult {
  id: string
  name: string
  category: string
  description: string
  address: string
  latitude: number
  longitude: number
  profilePhoto: string | null
  coverPhoto: string | null
  socialLinks: unknown
}

export interface UserSearchResult {
  id: string
  username: string
  profilePhoto: string | null
  socialLinks: unknown
}

export class SearchService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Search businesses by name or category (case-insensitive).
   * Only returns ACTIVE businesses. Never returns financial data.
   * Requirements: 14.1, 14.3, 14.7, 14.8
   */
  async searchBusinesses(query: string): Promise<BusinessSearchResult[]> {
    const businesses = await this.prisma.business.findMany({
      where: {
        status: BusinessStatus.ACTIVE,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        address: true,
        latitude: true,
        longitude: true,
        profilePhoto: true,
        coverPhoto: true,
        socialLinks: true,
        // Explicitly NOT selecting: wallet, ownerId, transactions
      },
    })

    return businesses
  }

  /**
   * Search users by username (case-insensitive).
   * Never returns email, coinBalance, diamondBalance, or transactions.
   * Requirements: 14.3, 14.4, 1.9
   */
  async searchUsers(query: string): Promise<UserSearchResult[]> {
    const users = await this.prisma.user.findMany({
      where: {
        username: { contains: query, mode: 'insensitive' },
      },
      select: {
        id: true,
        username: true,
        profilePhoto: true,
        socialLinks: true,
        // Explicitly NOT selecting: email, wallet, businesses, transactions
      },
    })

    return users
  }
}
