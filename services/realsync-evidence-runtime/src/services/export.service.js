import { getDb } from '../lib/db.js'
import { EvidenceService } from './evidence.service.js'
import { publish } from '../lib/nats.js'
import { createWriteStream, mkdirSync } from 'fs'
import { join } from 'path'

const db = () => getDb()
const STORAGE = process.env.STORAGE_PATH || '/data/evidence'
const EXPORT_TTL_MS = parseInt(process.env.EXPORT_TTL_MS || String(7 * 24 * 60 * 60 * 1000))

export const ExportService = {
  async request({ tenant_id, type, filter = {}, requested_by }) {
    const [req] = await db()`
      INSERT INTO export_requests (tenant_id, requested_by, type, filter)
      VALUES (${tenant_id}, ${requested_by || null}, ${type}, ${JSON.stringify(filter)})
      RETURNING *
    `
    // Process async (in production: queue job)
    setImmediate(() => this.process(req.id, tenant_id, type, filter).catch(console.error))
    return req
  },

  async process(export_id, tenant_id, type, filter) {
    const db_ = getDb()

    await db_`UPDATE export_requests SET status = 'processing' WHERE id = ${export_id}`

    try {
      const records = await EvidenceService.query({
        tenant_id,
        type: type !== 'full' ? filter.evidence_type : undefined,
        from: filter.from,
        to: filter.to,
        limit: 10000,
      })

      mkdirSync(join(STORAGE, 'exports'), { recursive: true })
      const filename = `export-${type}-${tenant_id}-${Date.now()}.jsonl`
      const filepath = join(STORAGE, 'exports', filename)

      const stream = createWriteStream(filepath)
      for (const record of records) {
        stream.write(JSON.stringify(record) + '\n')
      }
      stream.end()

      // Wait for the file to flush before marking the export ready —
      // otherwise a fast downstream consumer can race the write.
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve)
        stream.on('error', reject)
      })

      const expiresAt = new Date(Date.now() + EXPORT_TTL_MS)

      await db_`
        UPDATE export_requests
        SET status = 'ready',
            record_count = ${records.length},
            file_path = ${filepath},
            expires_at = ${expiresAt},
            completed_at = NOW()
        WHERE id = ${export_id}
      `

      await publish('evidence.export.ready', {
        export_id,
        tenant_id,
        type,
        record_count: records.length,
        file_path: filepath,
        expires_at: expiresAt.toISOString(),
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      await db_`
        UPDATE export_requests
        SET status = 'failed', completed_at = NOW()
        WHERE id = ${export_id}
      `
      throw err
    }
  },

  async getStatus(export_id, tenant_id) {
    const [req] = await db()`
      SELECT * FROM export_requests
      WHERE id = ${export_id} AND tenant_id = ${tenant_id}
    `
    return req || null
  },

  async list(tenant_id, { limit = 50 } = {}) {
    return db()`
      SELECT * FROM export_requests
      WHERE tenant_id = ${tenant_id}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  },
}
