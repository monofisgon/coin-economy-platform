import type { SocialLinks } from './user'

export enum BusinessStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
}

export interface Business {
  id: string
  ownerId: string
  name: string
  description: string
  category: string
  address: string
  latitude: number
  longitude: number
  profilePhoto?: string
  coverPhoto?: string
  socialLinks?: SocialLinks
  status: BusinessStatus
  createdAt: Date
  updatedAt: Date
}

export interface CreateBusinessDTO {
  name: string
  description: string
  category: string
  address: string
  latitude: number
  longitude: number
  profilePhoto?: string
  coverPhoto?: string
}

export interface UpdateBusinessDTO {
  name?: string
  description?: string
  category?: string
  address?: string
  latitude?: number
  longitude?: number
  profilePhoto?: string
  coverPhoto?: string
  socialLinks?: SocialLinks
}

export interface BusinessProfile extends Business {
  products?: import('./transaction').Product[]
}
