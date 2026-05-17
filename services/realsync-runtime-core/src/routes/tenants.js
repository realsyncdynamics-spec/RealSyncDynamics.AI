import { TenantService } from '../services/tenant.service.js'
import { z } from 'zod'

const CreateTenantSchema = z.object({
  slug: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(128),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
})

export const tenantRoute = async (app) => {
  // Internal API key guard for all tenant routes
  app.addHook('onRequest', async (req, reply) => {
    const key = req.headers['x-internal-api-key']
    if (!key || key !== process.env.GATEWAY_INTERNAL_API_KEY) {
      return reply.code(401).send({ error: 'unauthorized' })
    }
  })

  app.post('/tenants', async (req, reply) => {
    const parsed = CreateTenantSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const tenant = await TenantService.create(parsed.data)
    return reply.code(201).send(tenant)
  })

  app.get('/tenants', async (req, reply) => {
    const tenants = await TenantService.list()
    return reply.send({ tenants })
  })

  app.get('/tenants/:id', async (req, reply) => {
    const tenant = await TenantService.getById(req.params.id)
    if (!tenant) return reply.code(404).send({ error: 'not_found' })
    return reply.send(tenant)
  })
}
