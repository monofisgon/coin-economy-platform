export enum TransactionType {
  COIN_RECHARGE = 'COIN_RECHARGE',
  DIAMOND_RECHARGE = 'DIAMOND_RECHARGE',
  DONATION = 'DONATION',
  PRODUCT_PURCHASE = 'PRODUCT_PURCHASE',
  MARKETPLACE_SALE = 'MARKETPLACE_SALE',
  MARKETPLACE_PURCHASE = 'MARKETPLACE_PURCHASE',
  OFFER_CANCEL_RETURN = 'OFFER_CANCEL_RETURN',
  DIAMOND_REFUND = 'DIAMOND_REFUND',
  INCENTIVE_DISTRIBUTION = 'INCENTIVE_DISTRIBUTION',
}

export interface Transaction {
  id: string
  type: TransactionType
  fromWalletId?: string
  toWalletId?: string
  coinAmount?: number
  diamondAmount?: number
  copAmount?: number
  platformFee?: number
  incentiveFund?: number
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface Product {
  id: string
  businessId: string
  name: string
  description: string
  imageUrl?: string
  coinPrice: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateProductDTO {
  name: string
  description: string
  imageUrl?: string
  coinPrice: number
}

export interface UpdateProductDTO {
  name?: string
  description?: string
  imageUrl?: string
  coinPrice?: number
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

export interface TxFilters {
  type?: TransactionType
}
