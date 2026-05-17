import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import 'dotenv/config'
import { config } from './config.js'
import { getDb } from './lib/db.js'
import { getRedis } from './lib/redis.js'
import { getNats } from './lib/nats.js'
import { startEventConsumer } from './consumers/event.consumer.js'
import { healthRoute } from './routes/health.js'
import { authRoute } from './routes/auth.js'
import { tenantRoute } from './routes/tenants.js'
import { agentRoute } from './routes/agents.js'
import { policyRoute } from './routes/policies.js'

const app = Fastify({ logger: { level: config.logLevel }, trustProxy: true })

await app.register(helmet, { contentSecurityPolicy: false })
await app.register(cors)

// Routes
await app.register(healthRoute)
await app.register(authRoute)
await app.register(tenantRoute)
await app.register(agentRoute)
await app.register(policyRoute)

// Error handler
app.setErrorHandler((err, req, reply) => {
  app.log.error(err)
  reply.code(err.statusCode || 500).send({
    error: err.code || 'internal_error',
    message: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
  })
})

const start = async () => {
  try {
    // Init connections
    getDb()
    await getRedis()
    await getNats()

    // Run migrations
    const { default: migrate } = await import('./db/migrate.js').catch(() => ({ default: null }))
    if (migrate) await migrate()

    // Start NATS event consumer
    await startEventConsumer()

    await app.listen({ port: config.port, host: '0.0.0.0' })
    app.log.info(`realsync-runtime-core on port ${config.port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

process.on('SIGTERM', async () => { await app.close(); process.exit(0) })
process.on('SIGINT',  async () => { await app.close(); process.exit(0) })

start()
