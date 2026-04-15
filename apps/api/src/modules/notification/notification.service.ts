import { PrismaClient } from '@prisma/client'
import type { Notification } from '@prisma/client'
import type { Server as SocketIOServer } from 'socket.io'

export type NotificationEvent =
  | { type: 'DONATION_RECEIVED'; coins: number; businessName: string }
  | { type: 'MARKETPLACE_COMPLETED'; role: 'buyer' | 'seller'; coins: number; diamonds: number }
  | { type: 'PRODUCT_PURCHASED'; productName: string; buyerUsername: string }
  | { type: 'TICKET_STATUS_CHANGED'; ticketId: string; newStatus: string }

export class NotificationService {
  private io: SocketIOServer | null = null

  constructor(private readonly prisma: PrismaClient) {}

  setSocketIO(io: SocketIOServer) {
    this.io = io
  }

  /**
   * Persist notification and emit via Socket.IO to the user's room.
   * Requirements: 11.1, 11.2, 11.3
   */
  async send(userId: string, event: NotificationEvent): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: event.type,
        payload: event as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    })

    // Emit real-time notification to user's socket room
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notification', {
        id: notification.id,
        type: notification.type,
        payload: notification.payload,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      })
    }

    return notification
  }

  /**
   * List all notifications for a user, ordered by createdAt DESC.
   * Requirements: 11.4
   */
  async listNotifications(userId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Mark a notification as read.
   * Requirements: 11.5
   */
  async markAsRead(userId: string, notificationId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      const err = new Error('Notification not found')
      ;(err as NodeJS.ErrnoException).code = 'NOTIFICATION_NOT_FOUND'
      throw err
    }

    if (notification.userId !== userId) {
      const err = new Error('You can only mark your own notifications as read')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    })
  }
}
