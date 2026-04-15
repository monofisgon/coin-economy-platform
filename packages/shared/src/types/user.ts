export enum UserRole {
  USER = 'USER',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
  ADMIN = 'ADMIN',
}

export interface SocialLinks {
  instagram?: string
  facebook?: string
  tiktok?: string
  whatsapp?: string
  website?: string
}

export interface User {
  id: string
  email: string
  username: string
  name?: string
  profilePhoto?: string
  socialLinks?: SocialLinks
  isLocked: boolean
  lockedUntil?: Date
  failedLogins: number
  emailVerified: boolean
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

export interface PublicUserProfile {
  id: string
  username: string
  profilePhoto?: string
  socialLinks?: SocialLinks
}

export interface RegisterUserDTO {
  email: string
  username: string
  password: string
}

export interface LoginDTO {
  email: string
  password: string
}

export interface UpdateProfileDTO {
  name?: string
  username?: string
  profilePhoto?: string
  socialLinks?: SocialLinks
  email?: string
  password?: string
}

export interface AuthToken {
  accessToken: string
  expiresIn: number
}
