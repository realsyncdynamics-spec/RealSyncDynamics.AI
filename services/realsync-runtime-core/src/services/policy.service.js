import { getDb } from '../lib/db.js'
import { publish } from '../lib/nats.js'

const db = () => getDb()

export const PolicyService = {
  async create({ tenant_id, name, type, rules, created_by }) {
    const [policy] = await db()`
      INSERT INTO policies (tenant_id, name, type, rules, created_by)
      VALUES (${tenant_id}, ${name}, ${type}, ${JSON.stringify(rules)}, ${created_by})
      RETURNING *
    `
    await publish('policy.updated', {
      policy_id: policy.id,
      tenant_id,
      type,
      status: 'draft',
      timestamp: new Date().toISOString(),
    })
    return policy
  },

  async activate(id, tenant_id) {
    const [policy] = await db()`
      UPDATE policies SET status = 'active', updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenant_id}
      RETURNING *
    `
    await publish('policy.updated', {
      policy_id: id,
      tenant_id,
      status: 'active',
      timestamp: new Date().toISOString(),
    })
    return policy
  },

  async getForTenant(tenant_id) {
    return db()`
      SELECT * FROM policies
      WHERE tenant_id = ${tenant_id} AND status = 'active'
      ORDER BY type, name
    `
  },

  async evaluate(tenant_id, context) {
    // Simple policy evaluation engine
    const policies = await this.getForTenant(tenant_id)
    const violations = []
    const passed = []

    for (const policy of policies) {
      const rules = policy.rules
      let violated = false

      // Rule: data_retention
      if (rules.max_retention_days && context.age_days > rules.max_retention_days) {
        violations.push({ policy_id: policy.id, rule: 'data_retention', detail: `Age ${context.age_days}d exceeds ${rules.max_retention_days}d` })
        violated = true
      }

      // Rule: required_fields
      if (rules.required_fields && Array.isArray(rules.required_fields)) {
        for (const field of rules.required_fields) {
          if (!context[field]) {
            violations.push({ policy_id: policy.id, rule: 'required_field', detail: `Missing: ${field}` })
            violated = true
          }
        }
      }

      if (!violated) passed.push(policy.id)
    }

    return {
      tenant_id,
      compliant: violations.length === 0,
      violations,
      passed_policies: passed.length,
      evaluated_at: new Date().toISOString(),
    }
  },
}
