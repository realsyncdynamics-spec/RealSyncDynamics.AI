import { z } from 'zod'
import { EvidenceService } from '../services/evidence.service.js'
import { config } from '../config.js'

const CreateEvidenceSchema = z.object({
  tenant_id: z.string().uuid(),
  type:      z.string().min(1).max(64),
  source:    z.string().min(1).max(128),
  subject:   z.string().min(1).max(256),
  payload:   z.record(z.unknown()),
  file_path: z.string().optional(),
  tags:      z.array(z.string()).optional(),
})

const QuerySchema = z.object({
  type:   z.string().optional(),
  from:   z.string().datetime().optional(),
  to:     z.string().datetime().optional(),
  tags:   z.union([z.string(), z.array(z.string())]).optional(),
  limit:  z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

// Trusted-tenant header from core/Traefik forward-auth.
const requireTenantHeader = (req, reply) => {
  const tenant_id = req.headers['x-tenant-id']
  if (!tenant_id) {
    reply.code(400).send({ error: 'x-tenant-id header required' })
    return null
  }
  return tenant_id
}

// Internal API key — only the core service and Traefik forward-auth
// know it. Required for writes.
const requireInternalKey = (req, reply) => {
  const key = req.headers['x-internal-api-key']
  if (!key || key !== config.internalApiKey) {
    reply.code(401).send({ error: 'unauthorized' })
    return false
  }
  return true
}

export const evidenceRoute = async (app) => {
  app.post('/evidence', async (req, reply) => {
    if (!requireInternalKey(req, reply)) return
    const parsed = CreateEvidenceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const record = await EvidenceService.create(parsed.data)
    return reply.code(201).send(record)
  })

  app.get('/evidence', async (req, reply) => {
    const tenant_id = requireTenantHeader(req, reply)
    if (!tenant_id) return
    const parsed = QuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const tags = parsed.data.tags
      ? (Array.isArray(parsed.data.tags) ? parsed.data.tags : [parsed.data.tags])
      : undefined
    const records = await EvidenceService.query({ tenant_id, ...parsed.data, tags })
    return reply.send({ records, count: records.length })
  })

  app.get('/evidence/:id', async (req, reply) => {
    const tenant_id = requireTenantHeader(req, reply)
    if (!tenant_id) return
    const record = await EvidenceService.getById(req.params.id, tenant_id)
    if (!record) return reply.code(404).send({ error: 'not_found' })
    return reply.send(record)
  })

  app.get('/evidence/:id/verify', async (req, reply) => {
    const tenant_id = requireTenantHeader(req, reply)
    if (!tenant_id) return
    const result = await EvidenceService.verifyIntegrity(req.params.id, tenant_id)
    return reply.send(result)
  })
}
