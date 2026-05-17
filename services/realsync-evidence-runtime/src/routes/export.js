import { z } from 'zod'
import { createReadStream, statSync } from 'fs'
import { ExportService } from '../services/export.service.js'

const RequestExportSchema = z.object({
  type:         z.enum(['dsgvo', 'tax', 'audit', 'full']),
  filter:       z.record(z.unknown()).optional(),
  requested_by: z.string().optional(),
})

const requireTenantHeader = (req, reply) => {
  const tenant_id = req.headers['x-tenant-id']
  if (!tenant_id) {
    reply.code(400).send({ error: 'x-tenant-id header required' })
    return null
  }
  return tenant_id
}

export const exportRoute = async (app) => {
  app.post('/exports', async (req, reply) => {
    const tenant_id = requireTenantHeader(req, reply)
    if (!tenant_id) return
    const parsed = RequestExportSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const exportReq = await ExportService.request({ tenant_id, ...parsed.data })
    return reply.code(202).send(exportReq)
  })

  app.get('/exports', async (req, reply) => {
    const tenant_id = requireTenantHeader(req, reply)
    if (!tenant_id) return
    const exports = await ExportService.list(tenant_id)
    return reply.send({ exports })
  })

  app.get('/exports/:id', async (req, reply) => {
    const tenant_id = requireTenantHeader(req, reply)
    if (!tenant_id) return
    const exportReq = await ExportService.getStatus(req.params.id, tenant_id)
    if (!exportReq) return reply.code(404).send({ error: 'not_found' })
    return reply.send(exportReq)
  })

  app.get('/exports/:id/download', async (req, reply) => {
    const tenant_id = requireTenantHeader(req, reply)
    if (!tenant_id) return
    const exportReq = await ExportService.getStatus(req.params.id, tenant_id)
    if (!exportReq)               return reply.code(404).send({ error: 'not_found' })
    if (exportReq.status !== 'ready') return reply.code(409).send({ error: 'not_ready', status: exportReq.status })
    if (exportReq.expires_at && new Date(exportReq.expires_at) < new Date()) {
      return reply.code(410).send({ error: 'expired' })
    }
    if (!exportReq.file_path) return reply.code(500).send({ error: 'file_missing' })

    try { statSync(exportReq.file_path) }
    catch { return reply.code(410).send({ error: 'file_gone' }) }

    reply.header('content-type', 'application/x-ndjson')
    reply.header('content-disposition', `attachment; filename="${exportReq.id}.jsonl"`)
    return reply.send(createReadStream(exportReq.file_path))
  })
}
