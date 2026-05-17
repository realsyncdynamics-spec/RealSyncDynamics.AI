import { AgentService } from '../services/agent.service.js'

export const agentRoute = async (app) => {
  app.get('/agents', async (req, reply) => {
    const tenant_id = req.headers['x-tenant-id']
    if (!tenant_id) return reply.code(400).send({ error: 'x-tenant-id required' })
    const agents = await AgentService.list(tenant_id)
    return reply.send({ agents })
  })

  app.post('/agents/:id/dispatch', async (req, reply) => {
    const tenant_id = req.headers['x-tenant-id']
    if (!tenant_id) return reply.code(400).send({ error: 'x-tenant-id required' })
    try {
      const agent = await AgentService.dispatch(req.params.id, tenant_id, req.body)
      return reply.send({ dispatched: true, agent })
    } catch (err) {
      return reply.code(409).send({ error: err.message })
    }
  })
}
