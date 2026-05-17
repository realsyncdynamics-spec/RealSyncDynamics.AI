import pino from 'pino'
import { getNats, jc } from '../lib/nats.js'
import { EvidenceService } from '../services/evidence.service.js'

const log = pino({ level: process.env.LOG_LEVEL || 'info' })

// Map incoming runtime events to immutable evidence records. The
// `type` column is constrained by application convention (see
// schema.sql: invoice | ocr_result | agent_decision | dsgvo_find |
// tax_document | inventory_change).
//
// Subjects we deliberately DO NOT subscribe to:
//  - evidence.created      (we emit it — would feedback-loop)
//  - evidence.export.ready (export side-channel, already audited via DB)
const EVENT_TO_EVIDENCE_TYPE = {
  'invoice.received':        'invoice',
  'ai.risk.classified':      'dsgvo_find',
  'agent.executed':          'agent_decision',
  'inventory.updated':       'inventory_change',
  'tax.package.prepared':    'tax_document',
  'runtime.scan.completed':  'ocr_result',
  'policy.updated':          'agent_decision',
}

export const startEventConsumer = async () => {
  const nc = await getNats()

  for (const [subject, evidenceType] of Object.entries(EVENT_TO_EVIDENCE_TYPE)) {
    const sub = nc.subscribe(subject)
    ;(async () => {
      for await (const msg of sub) {
        try {
          const payload = jc.decode(msg.data)

          // Drop events without a tenant — evidence is always
          // tenant-scoped. System-level events go to runtime-core's
          // audit_log, not here.
          if (!payload.tenant_id) {
            log.debug({ subject }, 'event has no tenant_id, skipping evidence persistence')
            continue
          }

          await EvidenceService.create({
            tenant_id: payload.tenant_id,
            type:      evidenceType,
            source:    payload.source || subject.split('.')[0],
            subject,
            payload,
          })
        } catch (err) {
          log.error({ err, subject }, 'failed to persist evidence record')
        }
      }
    })()
  }

  log.info({ subjects: Object.keys(EVENT_TO_EVIDENCE_TYPE) }, 'evidence event consumer started')
}
