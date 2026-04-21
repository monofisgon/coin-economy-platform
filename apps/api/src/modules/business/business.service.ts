import { PrismaClient, Business, BusinessStatus, WalletOwner } from '@prisma/client'
import { MAX_BUSINESSES_PER_USER } from '@krowdco/shared'
import type { CreateBusinessDTO, UpdateBusinessDTO } from './business.schema'

export interface BusinessProfile {
  id: string
  ownerId: string
  name: string
  description: string
  category: string
  address: string
  latitude: number
  longitude: number
  profilePhoto: string | null
  coverPhoto: string | null
  socialLinks: unknown
  status: BusinessStatus
  createdAt: Date
  updatedAt: Date
  products: Array<{
    id: string
    name: string
    description: string
    imageUrl: string | null
    coinPrice: unknown
    isActive: boolean
    createdAt: Date
  }>
}

export class BusinessService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(ownerId: string, data: CreateBusinessDTO): Promise<Business> {
    // Validate max businesses per user
    const count = await this.prisma.business.count({ where: { ownerId } })
    if (count >= MAX_BUSINESSES_PER_USER) {
      const err = new Error(
        `Maximum of ${MAX_BUSINESSES_PER_USER} businesses per user has been reached`,
      )
      ;(err as NodeJS.ErrnoException).code = 'BUSINESS_LIMIT_REACHED'
      throw err
    }

    // Create business + wallet atomically
    const business = await this.prisma.$transaction(async (tx) => {
      const newBusiness = await tx.business.create({
        data: {
          ownerId,
          name: data.name,
          description: data.description,
          category: data.category,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          profilePhoto: data.profilePhoto ?? null,
          coverPhoto: data.coverPhoto ?? null,
          socialLinks: data.socialLinks ?? undefined,
          status: BusinessStatus.PENDING,
        },
      })

      await tx.wallet.create({
        data: {
          ownerType: WalletOwner.BUSINESS,
          businessId: newBusiness.id,
          coinBalance: 0,
          diamondBalance: 0,
        },
      })

      return newBusiness
    })

    return business
  }

  async activate(businessId: string): Promise<Business> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } })
    if (!business) {
      const err = new Error('Business not found')
      ;(err as NodeJS.ErrnoException).code = 'BUSINESS_NOT_FOUND'
      throw err
    }

    return this.prisma.business.update({
      where: { id: businessId },
      data: { status: BusinessStatus.ACTIVE },
    })
  }

  async update(businessId: string, ownerId: string, data: UpdateBusinessDTO): Promise<Business> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } })
    if (!business) {
      const err = new Error('Business not found')
      ;(err as NodeJS.ErrnoException).code = 'BUSINESS_NOT_FOUND'
      throw err
    }

    if (business.ownerId !== ownerId) {
      const err = new Error('You are not the owner of this business')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.profilePhoto !== undefined && { profilePhoto: data.profilePhoto }),
        ...(data.coverPhoto !== undefined && { coverPhoto: data.coverPhoto }),
        ...(data.socialLinks !== undefined && { socialLinks: data.socialLinks }),
      },
    })
  }

  async getProfile(businessId: string): Promise<BusinessProfile> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        products: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            coinPrice: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    })

    if (!business) {
      const err = new Error('Business not found')
      ;(err as NodeJS.ErrnoException).code = 'BUSINESS_NOT_FOUND'
      throw err
    }

    return business
  }

  async listByOwner(ownerId: string): Promise<Business[]> {
    return this.prisma.business.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
