import { PrismaClient, TicketStatus } from '@prisma/client'
import type { Ticket } from '@prisma/client'
import { searchFAQ, type FAQResult } from './support.faq'

// Valid ticket status transitions
const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus | null> = {
  [TicketStatus.ABIERTO]: TicketStatus.EN_PROGRESO,
  [TicketStatus.EN_PROGRESO]: TicketStatus.RESUELTO,
  [TicketStatus.RESUELTO]: TicketStatus.CERRADO,
  [TicketStatus.CERRADO]: null,
}

export interface SupportChat {
  id: string
  requesterId: string
  status: 'OPEN' | 'CLOSED'
  rating: number | null
  createdAt: Date
}

// In-memory chat store for MVP (no DB model for chats)
const chatStore: Map<string, SupportChat> = new Map()
let chatIdCounter = 0

export class SupportService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Query the FAQ knowledge base.
   * Requirements: 13.1, 13.2
   */
  queryFAQ(question: string): FAQResult | null {
    return searchFAQ(question)
  }

  /**
   * Create a support ticket with status ABIERTO.
   * Requirements: 13.3
   */
  async createTicket(requesterId: string, description: string): Promise<Ticket> {
    if (!description || description.trim().length === 0) {
      const err = new Error('Description is required')
      ;(err as NodeJS.ErrnoException).code = 'VALIDATION_ERROR'
      throw err
    }

    return this.prisma.ticket.create({
      data: {
        requesterId,
        description: description.trim(),
        status: TicketStatus.ABIERTO,
      },
    })
  }

  /**
   * Update ticket status (Support_Agent only).
   * Valid sequence: ABIERTO → EN_PROGRESO → RESUELTO → CERRADO
   * Requirements: 13.4, 13.5, 13.8
   */
  async updateTicketStatus(
    agentId: string,
    ticketId: string,
    newStatus: TicketStatus,
  ): Promise<Ticket> {
    // Verify agent role
    const agent = await this.prisma.user.findUnique({ where: { id: agentId } })
    if (!agent || agent.role !== 'SUPPORT_AGENT') {
      const err = new Error('Only Support_Agents can update ticket status')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) {
      const err = new Error('Ticket not found')
      ;(err as NodeJS.ErrnoException).code = 'TICKET_NOT_FOUND'
      throw err
    }

    // Validate transition sequence
    const expectedNext = TICKET_TRANSITIONS[ticket.status]
    if (expectedNext !== newStatus) {
      const err = new Error(
        `Invalid status transition: ${ticket.status} → ${newStatus}. Expected: ${ticket.status} → ${expectedNext ?? 'none (already closed)'}`,
      )
      ;(err as NodeJS.ErrnoException).code = 'INVALID_TICKET_TRANSITION'
      throw err
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: newStatus },
    })

    // Notify ticket creator (Requirement 13.5)
    await this.prisma.notification.create({
      data: {
        userId: ticket.requesterId,
        type: 'TICKET_STATUS_CHANGED',
        payload: {
          ticketId,
          newStatus,
        },
      },
    })

    return updated
  }

  /**
   * Rate a closed ticket (1-5).
   * Requirements: 13.9
   */
  async rateTicket(userId: string, ticketId: string, rating: number): Promise<Ticket> {
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      const err = new Error('Rating must be an integer between 1 and 5')
      ;(err as NodeJS.ErrnoException).code = 'INVALID_RATING'
      throw err
    }

    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) {
      const err = new Error('Ticket not found')
      ;(err as NodeJS.ErrnoException).code = 'TICKET_NOT_FOUND'
      throw err
    }

    if (ticket.requesterId !== userId) {
      const err = new Error('Only the ticket creator can rate it')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    if (ticket.status !== TicketStatus.CERRADO) {
      const err = new Error('Ticket must be closed before rating')
      ;(err as NodeJS.ErrnoException).code = 'TICKET_NOT_CLOSED'
      throw err
    }

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { rating },
    })
  }

  /**
   * Initiate a support chat.
   * For MVP: no agent is ever available, so always creates a Ticket automatically.
   * Requirements: 13.6, 13.7
   */
  async initiateChat(requesterId: string, context: string): Promise<{ ticket: Ticket; chatId: string }> {
    // MVP: simulate no agent available
    const agentAvailable = false

    if (agentAvailable) {
      // Would initiate real-time chat session (not implemented in MVP)
      throw new Error('Live chat not available in MVP')
    }

    // No agent available: create ticket automatically (Requirement 13.7)
    const ticket = await this.createTicket(
      requesterId,
      context || 'Solicitud de chat de soporte (sin agente disponible)',
    )

    const chatId = `chat-${++chatIdCounter}`
    const chat: SupportChat = {
      id: chatId,
      requesterId,
      status: 'CLOSED',
      rating: null,
      createdAt: new Date(),
    }
    chatStore.set(chatId, chat)

    return { ticket, chatId }
  }

  /**
   * Rate a support chat (1-5).
   * Requirements: 13.10
   */
  async rateChat(userId: string, chatId: string, rating: number): Promise<SupportChat> {
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      const err = new Error('Rating must be an integer between 1 and 5')
      ;(err as NodeJS.ErrnoException).code = 'INVALID_RATING'
      throw err
    }

    const chat = chatStore.get(chatId)
    if (!chat) {
      const err = new Error('Chat not found')
      ;(err as NodeJS.ErrnoException).code = 'CHAT_NOT_FOUND'
      throw err
    }

    if (chat.requesterId !== userId) {
      const err = new Error('Only the chat requester can rate it')
      ;(err as NodeJS.ErrnoException).code = 'FORBIDDEN'
      throw err
    }

    chat.rating = rating
    chatStore.set(chatId, chat)
    return chat
  }
}
