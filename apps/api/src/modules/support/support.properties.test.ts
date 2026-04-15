import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import { TicketStatus } from '@prisma/client'
import { SupportService } from './support.service'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_SEQUENCE: TicketStatus[] = [
  TicketStatus.ABIERTO,
  TicketStatus.EN_PROGRESO,
  TicketStatus.RESUELTO,
  TicketStatus.CERRADO,
]

type MockTicket = {
  id: string
  requesterId: string
  description: string
  status: TicketStatus
  rating: number | null
  createdAt: Date
  updatedAt: Date
}

type MockUser = {
  id: string
  role: string
}

function buildMockPrisma(ticket: MockTicket, agent: MockUser) {
  let currentTicket = { ...ticket }

  return {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id === agent.id) return agent
        return null
      },
    },
    ticket: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id === currentTicket.id) return currentTicket
        return null
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<MockTicket> }) => {
        if (where.id === currentTicket.id) {
          currentTicket = { ...currentTicket, ...data }
          return currentTicket
        }
        throw new Error('Ticket not found')
      },
    },
    notification: {
      create: async () => ({ id: 'notif-1' }),
    },
  } as unknown as import('@prisma/client').PrismaClient
}

// ─── Property 24: Secuencia válida de estados de Ticket ──────────────────────

// Feature: coin-economy-platform, Property 24: Secuencia válida de estados de Ticket
describe('Property 24: Valid ticket status sequence', () => {
  test('valid transitions in sequence are accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Pick a starting index (0=ABIERTO, 1=EN_PROGRESO, 2=RESUELTO)
        fc.integer({ min: 0, max: 2 }),
        async (startIdx) => {
          const currentStatus = VALID_SEQUENCE[startIdx]
          const nextStatus = VALID_SEQUENCE[startIdx + 1]

          const ticket: MockTicket = {
            id: 'ticket-1',
            requesterId: 'user-1',
            description: 'Test ticket',
            status: currentStatus,
            rating: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          const agent: MockUser = { id: 'agent-1', role: 'SUPPORT_AGENT' }
          const prisma = buildMockPrisma(ticket, agent)
          const service = new SupportService(prisma)

          const updated = await service.updateTicketStatus('agent-1', 'ticket-1', nextStatus)
          expect(updated.status).toBe(nextStatus)
        },
      ),
      { numRuns: 100 },
    )
  })

  test('invalid transitions are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Pick a starting status index
        fc.integer({ min: 0, max: 3 }),
        // Pick a target status index that is NOT the valid next one
        fc.integer({ min: 0, max: 3 }),
        async (fromIdx, toIdx) => {
          const fromStatus = VALID_SEQUENCE[fromIdx]
          const toStatus = VALID_SEQUENCE[toIdx]

          // Skip valid transitions and same-status (not a transition)
          const validNextIdx = fromIdx + 1
          if (toIdx === validNextIdx) return // valid transition, skip
          if (fromIdx === toIdx) return // same status, skip

          const ticket: MockTicket = {
            id: 'ticket-1',
            requesterId: 'user-1',
            description: 'Test ticket',
            status: fromStatus,
            rating: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          const agent: MockUser = { id: 'agent-1', role: 'SUPPORT_AGENT' }
          const prisma = buildMockPrisma(ticket, agent)
          const service = new SupportService(prisma)

          await expect(
            service.updateTicketStatus('agent-1', 'ticket-1', toStatus),
          ).rejects.toMatchObject({ code: 'INVALID_TICKET_TRANSITION' })
        },
      ),
      { numRuns: 100 },
    )
  })

  test('CERRADO ticket cannot transition to any status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...VALID_SEQUENCE),
        async (targetStatus) => {
          const ticket: MockTicket = {
            id: 'ticket-1',
            requesterId: 'user-1',
            description: 'Test ticket',
            status: TicketStatus.CERRADO,
            rating: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          const agent: MockUser = { id: 'agent-1', role: 'SUPPORT_AGENT' }
          const prisma = buildMockPrisma(ticket, agent)
          const service = new SupportService(prisma)

          await expect(
            service.updateTicketStatus('agent-1', 'ticket-1', targetStatus),
          ).rejects.toMatchObject({ code: 'INVALID_TICKET_TRANSITION' })
        },
      ),
      { numRuns: 100 },
    )
  })
})
