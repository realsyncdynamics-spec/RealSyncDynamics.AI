import { getDb } from '../lib/db.js'
import { publish } from '../lib/nats.js'

const db = () => getDb()

export const AgentService = {
  async register({ tenant_id, name, type, config = {} }) {
    const [agent] = await db()`
      INSERT INTO agents (tenant_id, name, type, config)
      VALUES (${tenant_id}, ${name}, ${type}, ${JSON.stringify(config)})
      ON CONFLICT (tenant_id, name) DO UPDATE
        SET config = EXCLUDED.config, updated_at = NOW()
      RETURNING *
    `
    return agent
  },

  async list(tenant_id) {
    return db()`
      SELECT * FROM agents
      WHERE tenant_id = ${tenant_id}
      ORDER BY type, name
    `
  },

  async setStatus(id, status) {
    const [agent] = await db()`
      UPDATE agents
      SET status = ${status}, updated_at = NOW(),
          last_run_at = CASE WHEN ${status} = 'idle' THEN NOW() ELSE last_run_at END
      WHERE id = ${id}
      RETURNING *
    `
    return agent
  },

  async dispatch(id, tenant_id, payload = {}) {
    const [agent] = await db()`
      SELECT * FROM agents WHERE id = ${id} AND tenant_id = ${tenant_id}
    `
    if (!agent) throw new Error(`Agent ${id} not found`)
    if (agent.status === 'running') throw new Error(`Agent ${id} already running`)

    await this.setStatus(id, 'running')
    await publish('agent.dispatched', {
      agent_id: id,
      agent_type: agent.type,
      tenant_id,
      config: agent.config,
      payload,
      timestamp: new Date().toISOString(),
    })
    return agent
  },
}
