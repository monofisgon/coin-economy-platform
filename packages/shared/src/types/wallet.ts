export enum WalletOwner {
  USER = 'USER',
  BUSINESS = 'BUSINESS',
}

export interface Wallet {
  id: string
  ownerType: WalletOwner
  userId?: string
  businessId?: string
  coinBalance: number
  diamondBalance: number
  createdAt: Date
  updatedAt: Date
}

export interface WalletBalance {
  coinBalance: number
  diamondBalance: number
}
