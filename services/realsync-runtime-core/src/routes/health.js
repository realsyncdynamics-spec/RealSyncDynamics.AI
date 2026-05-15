import { getDb } from '../lib/db.js'
import { getRedis } from '../lib/redis.js'
import { getNats } from '../lib/nats.js'

export const healthRoute = async (app) => {
  app.get('/health', async (req, reply) => {
    const checks = {}

    try { await getDb()`SELECT 1`; checks.db = 'ok' }
    catch { checks.db = 'error' }

    try { const r = await getRedis(); await r.ping(); checks.redis = 'ok' }
    catch { checks.redis = 'error' }

    try { const n = await getNats(); checks.nats = n.isClosed() ? 'error' : 'ok' }
    catch { checks.nats = 'error' }

    const status = Object.values(checks).every(v => v === 'ok') ? 'ok' : 'degraded'
    return reply.code(status === 'ok' ? 200 : 503).send({
      status,
      service: 'realsync-runtime-core',
      timestamp: new Date().toISOString(),
      dependencies: checks,
    })
  })
}
