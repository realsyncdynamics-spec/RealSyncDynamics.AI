import { getNats, jc } from '../lib/nats.js'
import { AuditService } from '../services/audit.service.js'
import { AgentService } from '../services/agent.service.js'
import { getDb } from '../lib/db.js'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL || 'info' })
const db = () => getDb()

export const startEventConsumer = async () => {
  const nc = await getNats()

  // ── Store all runtime events ────────────────────────────────
  const subjects = [
    'runtime.scan.completed',
    'evidence.created',
    'policy.updated',
    'ai.risk.classified',
    'agent.executed',
    'agent.dispatched',
    'invoice.received',
    'inventory.updated',
    'tax.package.prepared',
  ]

  for (const subject of subjects) {
    const sub = nc.subscribe(subject)
    ;(async () => {
      for await (const msg of sub) {
        try {
          const payload = jc.decode(msg.data)
          log.debug({ subject, payload }, 'Event received')

          // Persist to runtime_events
          await db()`
            INSERT INTO runtime_events (tenant_id, subject, payload)
            VALUES (${payload.tenant_id || null}, ${subject}, ${JSON.stringify(payload)})
          `

          // Subject-specific handlers
          await handleEvent(subject, payload)

        } catch (err) {
          log.error({ err, subject }, 'Event processing error')
        }
      }
    })()
  }

  log.info({ subjects }, 'Event consumer started')
}

const handleEvent = async (subject, payload) => {
  switch (subject) {
    case 'agent.executed':
      // Mark agent idle after execution
      if (payload.agent_id) {
        await AgentService.setStatus(payload.agent_id, 'idle').catch(() => {})
      }
      // Audit log
      await AuditService.log({
        tenant_id: payload.tenant_id,
        action: 'agent.executed',
        subject,
        payload,
      })
      break

    case 'policy.updated':
      await AuditService.log({
        tenant_id: payload.tenant_id,
        action: 'policy.updated',
        subject,
        payload,
      })
      break

    case 'invoice.received':
      await AuditService.log({
        tenant_id: payload.tenant_id,
        action: 'invoice.received',
        subject,
        payload,
      })
      break

    default:
      // Generic audit for all other events
      if (payload.tenant_id) {
        await AuditService.log({
          tenant_id: payload.tenant_id,
          action: subject,
          subject,
          payload,
        }).catch(() => {})
      }
  }
}
