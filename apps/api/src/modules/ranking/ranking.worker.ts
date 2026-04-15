import { Worker } from 'bullmq'
import { rankingsQueue, QUEUE_NAMES } from '../../config/bullmq'
import { bullRedisConnection } from '../../config/redis'
import { RankingService } from './ranking.service'
import { prisma } from '../../config/prisma'

const rankingService = new RankingService(prisma)

// ─── Rankings Worker ──────────────────────────────────────────────────────────

export const rankingsWorker = new Worker(
  QUEUE_NAMES.RANKINGS,
  async (job) => {
    if (job.name === 'computeWeeklyRankings') {
      console.log('[RankingWorker] Computing weekly rankings...')
      await rankingService.computeWeeklyRankings()
      console.log('[RankingWorker] Weekly rankings computed.')

      console.log('[RankingWorker] Distributing incentive fund...')
      await rankingService.distributeIncentiveFund()
      console.log('[RankingWorker] Incentive fund distributed.')
    }
  },
  { connection: bullRedisConnection },
)

rankingsWorker.on('completed', (job) => {
  console.log(`[RankingWorker] Job ${job.id} completed`)
})

rankingsWorker.on('failed', (job, err) => {
  console.error(`[RankingWorker] Job ${job?.id} failed:`, err)
})

/**
 * Schedule the weekly rankings cron job (every 7 days).
 * Requirements: 15.4
 */
export async function scheduleWeeklyRankings(): Promise<void> {
  // Remove existing repeatable jobs to avoid duplicates
  const repeatableJobs = await rankingsQueue.getRepeatableJobs()
  for (const job of repeatableJobs) {
    if (job.name === 'computeWeeklyRankings') {
      await rankingsQueue.removeRepeatableByKey(job.key)
    }
  }

  // Schedule every 7 days (604800000 ms)
  await rankingsQueue.add(
    'computeWeeklyRankings',
    {},
    {
      repeat: {
        every: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      },
    },
  )

  console.log('[RankingWorker] Weekly rankings cron job scheduled (every 7 days)')
}
