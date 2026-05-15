import { z } from 'zod'
import { EvidenceService } from '../services/evidence.service.js'

const AuditQuerySchema = z.object({
  from_seq: z.coerce.number().int().min(0).optional(),
  limit:    z.coerce.number().int().min(1).max(1000).optional(),
})

export const auditRoute = async (app) => {
  app.get('/audit', async (req, reply) => {
    const tenant_id = req.headers['x-tenant-id']
    if (!tenant_id) return reply.code(400).send({ error: 'x-tenant-id header required' })

    const parsed = AuditQuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const events = await EvidenceService.auditStream({ tenant_id, ...parsed.data })
    const next_seq = events.length > 0 ? events[events.length - 1].seq : null
    return reply.send({ events, next_seq, count: events.length })
  })
}
