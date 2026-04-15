export type NotificationEvent =
  | { type: 'DONATION_RECEIVED'; coins: number; businessName: string }
  | { type: 'MARKETPLACE_COMPLETED'; role: 'buyer' | 'seller'; coins: number; diamonds: number }
  | { type: 'PRODUCT_PURCHASED'; productName: string; buyerUsername: string }
  | { type: 'TICKET_STATUS_CHANGED'; ticketId: string; newStatus: string }

export interface Notification {
  id: string
  userId: string
  type: string
  payload: NotificationEvent
  isRead: boolean
  createdAt: Date
}
