import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import 'dotenv/config'
import { config } from './config.js'
import { getDb } from './lib/db.js'
import { getNats } from './lib/nats.js'
import { startEventConsumer } from './consumers/event.consumer.js'
import { healthRoute } from './routes/health.js'
import { evidenceRoute } from './routes/evidence.js'
import { exportRoute } from './routes/export.js'
import { auditRoute } from './routes/audit.js'

const app = Fastify({ logger: { level: config.logLevel }, trustProxy: true })

await app.register(helmet, { contentSecurityPolicy: false })
await app.register(cors)

await app.register(healthRoute)
await app.register(evidenceRoute)
await app.register(exportRoute)
await app.register(auditRoute)

app.setErrorHandler((err, req, reply) => {
  app.log.error(err)
  reply.code(err.statusCode || 500).send({
    error: err.code || 'internal_error',
    message: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
  })
})

const start = async () => {
  try {
    getDb()
    await getNats()
    await startEventConsumer()

    await app.listen({ port: config.port, host: '0.0.0.0' })
    app.log.info(`realsync-evidence-runtime on port ${config.port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

process.on('SIGTERM', async () => { await app.close(); process.exit(0) })
process.on('SIGINT',  async () => { await app.close(); process.exit(0) })

start()
