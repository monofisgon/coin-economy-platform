import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createWriteStream, mkdirSync } from 'fs'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import { pipeline } from 'stream/promises'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')

// Ensure upload directory exists
mkdirSync(UPLOAD_DIR, { recursive: true })

export async function uploadRoutes(app: FastifyInstance) {
  /**
   * POST /api/upload/avatar
   * Upload a profile photo. Returns the public URL.
   */
  app.post(
    '/avatar',
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await req.file()
        if (!data) {
          return reply.status(400).send({ code: 'NO_FILE', message: 'No file provided' })
        }

        const ext = extname(data.filename).toLowerCase()
        const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        if (!allowed.includes(ext)) {
          return reply.status(400).send({ code: 'INVALID_TYPE', message: 'Only images are allowed (jpg, png, webp, gif)' })
        }

        const filename = `${randomUUID()}${ext}`
        const filepath = join(UPLOAD_DIR, filename)

        await pipeline(data.file, createWriteStream(filepath))

        const url = `/uploads/${filename}`
        return reply.status(200).send({ url })
      } catch (err) {
        const error = err as Error
        return reply.status(500).send({ code: 'UPLOAD_ERROR', message: error.message })
      }
    },
  )
}
