import type { FastifyInstance } from 'fastify'

export async function configRoutes(fastify: FastifyInstance) {
  fastify.get('/api/config', async (request, reply) => {
    return {
      message: 'Get config placeholder',
      config: {},
    }
  })

  fastify.post('/api/config', async (request, reply) => {
    return {
      message: 'Post config placeholder',
      received: request.body,
    }
  })
}
