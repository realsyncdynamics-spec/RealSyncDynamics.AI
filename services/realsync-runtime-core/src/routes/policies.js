import { PolicyService } from '../services/policy.service.js'

export const policyRoute = async (app) => {
  app.get('/policies', async (req, reply) => {
    const tenant_id = req.headers['x-tenant-id']
    const policies = await PolicyService.getForTenant(tenant_id)
    return reply.send({ policies })
  })

  app.post('/policies/:id/activate', async (req, reply) => {
    const tenant_id = req.headers['x-tenant-id']
    const policy = await PolicyService.activate(req.params.id, tenant_id)
    return reply.send(policy)
  })

  app.post('/policies/evaluate', async (req, reply) => {
    const tenant_id = req.headers['x-tenant-id']
    const result = await PolicyService.evaluate(tenant_id, req.body)
    return reply.send(result)
  })
}
