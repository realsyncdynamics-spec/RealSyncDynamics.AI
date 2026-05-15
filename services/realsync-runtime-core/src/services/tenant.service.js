import { getDb } from '../lib/db.js'
import { publish } from '../lib/nats.js'

const db = () => getDb()

export const TenantService = {
  async create({ slug, name, plan = 'free', metadata = {} }) {
    const [tenant] = await db()`
      INSERT INTO tenants (slug, name, plan, metadata)
      VALUES (${slug}, ${name}, ${plan}, ${JSON.stringify(metadata)})
      RETURNING *
    `
    await publish('runtime.tenant.created', {
      tenant_id: tenant.id,
      slug: tenant.slug,
      plan: tenant.plan,
      timestamp: new Date().toISOString(),
    })
    return tenant
  },

  async getById(id) {
    const [tenant] = await db()`
      SELECT * FROM tenants WHERE id = ${id} AND status = 'active'
    `
    return tenant || null
  },

  async getBySlug(slug) {
    const [tenant] = await db()`
      SELECT * FROM tenants WHERE slug = ${slug} AND status = 'active'
    `
    return tenant || null
  },

  async list({ limit = 50, offset = 0 } = {}) {
    return db()`
      SELECT * FROM tenants
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  },

  async suspend(id) {
    const [tenant] = await db()`
      UPDATE tenants SET status = 'suspended', updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    await publish('runtime.tenant.suspended', { tenant_id: id })
    return tenant
  },
}
