const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw { status: res.status, code: data.code, message: data.message ?? 'Error desconocido' }
  return data as T
}

export interface AuthResponse {
  user: { id: string; email: string; username: string; name?: string; role: string }
  token: string
}

export interface PublicUser {
  id: string
  username: string
  profilePhoto?: string
  socialLinks?: { instagram?: string; facebook?: string; tiktok?: string; whatsapp?: string; website?: string }
}

export interface Offer {
  id: string
  sellerId: string
  coinAmount: number
  diamondPricePerCoin: number
  visibility: string
  status: string
  createdAt: string
  seller?: { username: string }
}

export interface BusinessProfile {
  id: string
  name: string
  description: string
  category: string
  address: string
  coordinates?: { lat: number; lng: number }
  latitude?: number
  longitude?: number
  status: string
  wallet?: { coinBalance: number }
}

export interface Product {
  id: string
  name: string
  description: string
  coinPrice: number
  isActive: boolean
  imageUrl?: string
  business?: { id: string; name: string }
}

export const api = {
  register(data: { email: string; username: string; name?: string; password: string }) {
    return request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) })
  },

  login(data: { email: string; password: string }) {
    return request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) })
  },

  searchUsers(q: string, token: string) {
    return request<{ users: PublicUser[] }>(`/api/search/users?q=${encodeURIComponent(q)}`, {}, token)
  },

  listOffers(token: string) {
    return request<{ offers: Offer[] }>('/api/marketplace/offers', {}, token)
  },

  getBusiness(id: string, token?: string) {
    return request<{ business: BusinessProfile; products: Product[] }>(`/api/businesses/${id}`, {}, token)
  },

  getCatalog(location: string, token?: string) {
    return request<{ products: Product[] }>(`/api/catalog?location=${encodeURIComponent(location)}`, {}, token)
  },

  purchaseProduct(productId: string, token: string) {
    return request<{ transaction: { id: string } }>(`/api/products/${productId}/purchase`, { method: 'POST' }, token)
  },

  getWalletBalance(walletId: string, token: string) {
    return request<{ balance: { coinBalance: number; diamondBalance: number } }>(`/api/wallets/${walletId}/balance`, {}, token)
  },

  getTransactions(walletId: string, token: string, params?: { type?: string; page?: number; limit?: number }) {
    const q = new URLSearchParams()
    if (params?.type) q.set('type', params.type)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    const qs = q.toString() ? `?${q.toString()}` : ''
    return request<{ transactions: Transaction[]; total: number; page: number; limit: number }>(
      `/api/wallets/${walletId}/transactions${qs}`,
      {},
      token,
    )
  },

  createOffer(data: { coinAmount: number; diamondPricePerCoin: number; visibility: 'PUBLICA' | 'PRIVADA' }, token: string) {
    return request<{ offer: Offer }>('/api/marketplace/offers', { method: 'POST', body: JSON.stringify(data) }, token)
  },

  acceptOffer(offerId: string, data: { accessCode?: string }, token: string) {
    return request<{ transaction: { id: string } }>(
      `/api/marketplace/offers/${offerId}/accept`,
      { method: 'POST', body: JSON.stringify(data) },
      token,
    )
  },

  cancelOffer(offerId: string, token: string) {
    return request<{ message: string }>(`/api/marketplace/offers/${offerId}`, { method: 'DELETE' }, token)
  },

  getRankings(type: string, year: number, token: string) {
    return request<{ rankings: RankingEntry[]; visible: boolean }>(
      `/api/rankings?type=${encodeURIComponent(type)}&year=${year}`,
      {},
      token,
    )
  },
}

export interface Transaction {
  id: string
  type: string
  amount: number
  currency: string
  createdAt: string
  description?: string
}

export interface RankingEntry {
  rank: number
  name: string
  username?: string
  metric: number
  id: string
}

export interface FeedItem {
  type: 'PRODUCT' | 'OFFER'
  id: string
  createdAt: string
  product?: Product
  offer?: Offer
  business?: { id: string; name: string }
  seller?: { username: string }
}

export interface PlatformStats {
  totalUsers: number
  totalActiveBusinesses: number
  incentiveFundCoins: number
}

export interface FollowStatus {
  following: boolean
  followId?: string
}

export const apiExtra = {
  getStats() {
    return request<PlatformStats>('/api/stats')
  },

  getUserProfile(username: string, token?: string) {
    return request<{ user: PublicUser & { offers?: Offer[] } }>(`/api/users/${encodeURIComponent(username)}`, {}, token)
  },

  followUser(userId: string, token: string) {
    return request<{ followId: string }>('/api/follows', { method: 'POST', body: JSON.stringify({ followedUserId: userId }) }, token)
  },

  followBusiness(businessId: string, token: string) {
    return request<{ followId: string }>('/api/follows', { method: 'POST', body: JSON.stringify({ followedBizId: businessId }) }, token)
  },

  unfollow(followId: string, token: string) {
    return request<{ message: string }>(`/api/follows/${followId}`, { method: 'DELETE' }, token)
  },

  rechargeDiamonds(token: string) {
    return request<{ transaction: { id: string } }>('/api/wallets/recharge/diamonds', { method: 'POST', body: JSON.stringify({}) }, token)
  },

  refundDiamonds(token: string) {
    return request<{ transaction: { id: string } }>('/api/wallets/refund/diamonds', { method: 'POST', body: JSON.stringify({}) }, token)
  },

  getFeed(token: string) {
    return request<{ items: FeedItem[]; message?: string }>('/api/feed', {}, token)
  },

  queryFAQ(query: string, token: string) {
    return request<{ answer: string; found: boolean }>('/api/support/query', { method: 'POST', body: JSON.stringify({ query }) }, token)
  },

  createTicket(data: { subject: string; description: string }, token: string) {
    return request<{ ticket: { id: string; status: string } }>('/api/support/tickets', { method: 'POST', body: JSON.stringify(data) }, token)
  },

  startChat(token: string) {
    return request<{ chatId?: string; ticketId?: string; agentAvailable: boolean }>('/api/support/chat', { method: 'POST', body: JSON.stringify({}) }, token)
  },
}
