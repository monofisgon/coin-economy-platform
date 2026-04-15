import { Queue, Worker, QueueEvents } from 'bullmq'
import { bullRedisConnection } from './redis'

// Queue names
export const QUEUE_NAMES = {
  RANKINGS: 'rankings',
  NOTIFICATIONS: 'notifications',
  PAYMENTS: 'payments',
} as const

// Rankings queue — weekly cron job
export const rankingsQueue = new Queue(QUEUE_NAMES.RANKINGS, {
  connection: bullRedisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

// Notifications queue — async delivery
export const notificationsQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
  connection: bullRedisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
})

// Payments queue — idempotent payment processing
export const paymentsQueue = new Queue(QUEUE_NAMES.PAYMENTS, {
  connection: bullRedisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
})

export { Queue, Worker, QueueEvents }
