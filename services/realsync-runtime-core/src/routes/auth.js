import { createHash } from 'crypto'
import { getDb } from '../lib/db.js'

export const authRoute = async (app) => {
  // Internal forward-auth endpoint (called by Traefik)
  app.get('/auth/verify', async (req, reply) => {
    const token = req.headers['authorization']?.replace('Bearer ', '')
    if (!token) return reply.code(401).send({ error: 'no_token' })

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const db = getDb()

    const [session] = await db`
      SELECT s.*, u.role, u.tenant_id as user_tenant_id
      FROM sessions s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
        AND s.expires_at > NOW()
    `.catch(() => [])

    if (!session) return reply.code(401).send({ error: 'invalid_session' })

    // Set headers for downstream services
    reply.header('X-Tenant-ID', session.tenant_id)
    reply.header('X-User-ID', session.user_id || '')
    reply.header('X-User-Role', session.role || 'viewer')
    return reply.code(200).send({ ok: true })
  })
}
