export enum TicketStatus {
  ABIERTO = 'ABIERTO',
  EN_PROGRESO = 'EN_PROGRESO',
  RESUELTO = 'RESUELTO',
  CERRADO = 'CERRADO',
}

export interface Ticket {
  id: string
  requesterId: string
  description: string
  status: TicketStatus
  rating?: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateTicketDTO {
  description: string
}

export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus | null> = {
  [TicketStatus.ABIERTO]: TicketStatus.EN_PROGRESO,
  [TicketStatus.EN_PROGRESO]: TicketStatus.RESUELTO,
  [TicketStatus.RESUELTO]: TicketStatus.CERRADO,
  [TicketStatus.CERRADO]: null,
}
