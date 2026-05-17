import { getDb } from '../lib/db.js'

const db = () => getDb()

export const AuditService = {
  async log({ tenant_id, user_id, action, subject, payload, ip_address }) {
    await db()`
      INSERT INTO audit_log (tenant_id, user_id, action, subject, payload, ip_address)
      VALUES (
        ${tenant_id}, ${user_id}, ${action}, ${subject},
        ${JSON.stringify(payload)}, ${ip_address}
      )
    `
  },

  async query({ tenant_id, subject, from, to, limit = 100 }) {
    return db()`
      SELECT * FROM audit_log
      WHERE tenant_id = ${tenant_id}
        ${subject ? db()`AND subject = ${subject}` : db()``}
        ${from    ? db()`AND created_at >= ${from}` : db()``}
        ${to      ? db()`AND created_at <= ${to}`   : db()``}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  },
}
