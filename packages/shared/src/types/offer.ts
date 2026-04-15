export enum OfferVisibility {
  PUBLICA = 'PUBLICA',
  PRIVADA = 'PRIVADA',
}

export enum OfferStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Offer {
  id: string
  sellerId: string
  coinAmount: number
  diamondPricePerCoin: number
  visibility: OfferVisibility
  accessCode?: string
  status: OfferStatus
  createdAt: Date
  updatedAt: Date
}

export interface CreateOfferDTO {
  coinAmount: number
  diamondPricePerCoin: number
  visibility: OfferVisibility
}

export interface OfferFilters {
  coinAmountMin?: number
  coinAmountMax?: number
  diamondPriceMin?: number
  diamondPriceMax?: number
}
