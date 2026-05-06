// Placeholder config routes — reserved for future use.
import type { FastifyInstance } from 'fastify'

export async function configRoutes(fastify: FastifyInstance) {
  fastify.get('/api/config', async () => {
    return {
      message: 'Get config placeholder',
      config: {},
    }
  })

  fastify.post('/api/config', async (request) => {
    return {
      message: 'Post config placeholder',
      received: request.body,
    }
  })
}
