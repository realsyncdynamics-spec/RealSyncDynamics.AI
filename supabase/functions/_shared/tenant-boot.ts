// Tenant-Boot (Release 1) — reine Logik des Provisioning-Orchestrators.
//
// `provision-tenant` fuehrt einen Tenant in einem idempotenten Durchgang von
// „Account existiert" zu „erster Beweis liegt in der Hash-Chain". Diese Datei
// enthaelt alles, was sich ohne Datenbank pruefen laesst: Schrittfolge,
// Observe-Modus, Connector-Status, Installer-Artefakte, Chain-Snapshot.
//
// Keine Deno-/jsr-Imports: vitest-importierbar (test/edge/tenant-boot.test.ts).

import type { PolicyAction } from './policyEngine.ts';

/** Reihenfolge ist Vertrag: jeder Schritt darf auf den vorherigen bauen. */
export const BOOT_STEPS = [
  'identity',        // Tenant + Owner/Admin serverseitig bestaetigt
  'entitlements',    // Plan -> Capability-Flags
  'catalog',         // Domain -> governance_assets (kein leerer Control Room)
  'policy_bundle',   // Templates -> governance_policies im Tenant, Mode observe
  'ingest_key',      // ein scoped Boot-Key, Klartext genau einmal
  'installer',       // vorkonfigurierter Worker + Verifikations-Call
  'first_evidence',  // Lifecycle-Events in der Evidence-Chain
] as const;

export type BootStepId = (typeof BOOT_STEPS)[number];

export type BootStepStatus = 'done' | 'skipped' | 'pending' | 'failed';

export interface BootStepResult {
  step: BootStepId;
  status: BootStepStatus;
  /** Kurzer, maschinenlesbarer Grund bei skipped/pending/failed. */
  reason?: string;
  /** Hat dieser Lauf etwas angelegt? Nur dann entsteht ein Chain-Eintrag. */
  created?: boolean;
  detail?: Record<string, unknown>;
}

export type BootRunStatus = 'completed' | 'partial' | 'failed';

/**
 * `failed`, sobald ein Schritt scheitert. `partial`, wenn etwas offen ist
 * (z. B. Connector noch nicht verifiziert oder Plan ohne API-Zugang).
 * `completed` nur, wenn jeder Schritt `done` ist.
 */
export function aggregateRunStatus(steps: BootStepResult[]): BootRunStatus {
  if (steps.some((s) => s.status === 'failed')) return 'failed';
  const all = BOOT_STEPS.every((id) => steps.find((s) => s.step === id)?.status === 'done');
  return all ? 'completed' : 'partial';
}

export const BOOT_TRIGGERS = ['self_service', 'free_audit', 'checkout', 'sales', 'agency_child'] as const;
export type BootTrigger = (typeof BOOT_TRIGGERS)[number];

/** Nur diese Trigger duerfen serverseitig (Service-Aufruf) ausgeloest werden. */
export const INTERNAL_TRIGGERS: readonly BootTrigger[] = ['checkout', 'sales', 'agency_child'];

export function isBootTrigger(v: unknown): v is BootTrigger {
  return typeof v === 'string' && (BOOT_TRIGGERS as readonly string[]).includes(v);
}

/** Packs, die jeder Tenant beim Boot bekommt — unabhaengig von der Branche. */
export const BASELINE_PACKS = ['dsgvo-essentials', 'tdddg-consent'] as const;

// ─── Observe-Modus ─────────────────────────────────────────────────────────
// Erster Zyklus beobachtet nur. Blockierende Aktionen werden zu `warn`
// herabgestuft; die Zielaktion bleibt in `enforce_action` erhalten und wird
// erst nach einem sauberen Zyklus bewusst scharf geschaltet.

export function observeAction(enforce: PolicyAction): PolicyAction {
  return enforce === 'block' || enforce === 'require_approval' ? 'warn' : enforce;
}

export interface PolicyTemplate {
  id: string;
  pack_id: string;
  version: number;
  name: string;
  description: string | null;
  policy_type: string;
  severity: string;
  enforce_action: PolicyAction;
  condition: Record<string, unknown>;
}

/**
 * Template -> Tenant-Policy-Zeile. Leere Bedingungen werden abgelehnt: in der
 * Engine matcht `{}` jedes Event, ein Template ohne Bedingung wuerde also
 * still ueber jedes Ingest entscheiden.
 */
export function policyRowFromTemplate(tenantId: string, t: PolicyTemplate) {
  if (!t.condition || Object.keys(t.condition).length === 0) {
    throw new Error(`policy template ${t.id} has an empty condition`);
  }
  return {
    tenant_id: tenantId,
    name: t.name,
    description: t.description,
    policy_type: t.policy_type,
    severity: t.severity,
    action: observeAction(t.enforce_action),
    enforce_action: t.enforce_action,
    mode: 'observe' as const,
    condition: t.condition,
    enabled: true,
    source_pack_id: t.pack_id,
    source_template_id: t.id,
    template_version: t.version,
  };
}

// ─── Discovery ─────────────────────────────────────────────────────────────

export function normalizeDomain(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const host = new URL(s.includes('://') ? s : `https://${s}`).hostname.toLowerCase().replace(/^www\./, '');
    // Mindestens ein Punkt, keine IP-Literale, kein localhost.
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.startsWith('[')) return null;
    return host;
  } catch {
    return null;
  }
}

// ─── Connector-Verifikation ────────────────────────────────────────────────
// „Installiert" ist erst wahr, wenn ein Event ankam. Deshalb gibt es keinen
// eigenen `installed`-Zustand, den jemand per Klick setzen koennte.

export type ConnectorStatus = 'issued' | 'verified' | 'stale' | 'revoked';

export const CONNECTOR_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function connectorStatus(k: {
  first_event_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
}, now: Date = new Date()): ConnectorStatus {
  if (k.revoked_at) return 'revoked';
  if (!k.first_event_at) return 'issued';
  const last = Date.parse(k.last_used_at ?? k.first_event_at);
  return now.getTime() - last > CONNECTOR_STALE_AFTER_MS ? 'stale' : 'verified';
}

// ─── Installer ─────────────────────────────────────────────────────────────
// Primaerer Installer ist ein Cloudflare Worker: der Ingest-Key bleibt dort
// ein Secret. Ein Browser-Snippet mit eingebettetem Key waere fuer jeden
// Besucher lesbar und damit ein offener Schreibzugang in die Evidence.

export const HEARTBEAT_EVENT_TYPE = 'connector.heartbeat';

export interface InstallerInput {
  ingestUrl: string;
  domain: string | null;
  assetId: string | null;
  keyPrefix: string;
}

export function buildWorkerScript(i: InstallerInput): string {
  const asset = i.assetId ? JSON.stringify(i.assetId) : 'null';
  return `// RealSyncDynamics.AI Governance Sensor — Cloudflare Worker (observe)
// Secret setzen: npx wrangler secret put RSD_INGEST_KEY   (Key ${i.keyPrefix}…)
const INGEST_URL = ${JSON.stringify(i.ingestUrl)};
const ASSET_ID = ${asset};
const HEARTBEAT_MS = 15 * 60 * 1000;
let lastBeat = 0;

async function beat(env, request) {
  const url = new URL(request.url);
  await fetch(INGEST_URL, {
    method: 'POST',
    headers: { 'authorization': 'Bearer ' + env.RSD_INGEST_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ event: {
      event_type: ${JSON.stringify(HEARTBEAT_EVENT_TYPE)},
      event_source: 'website_scanner',
      title: 'Sensor heartbeat ' + url.hostname,
      risk_level: 'info',
      asset_id: ASSET_ID,
      payload: { host: url.hostname, sensor: 'cf-worker', version: 1 },
    } }),
  });
}

export default {
  async fetch(request, env, ctx) {
    const response = await fetch(request);
    if (env.RSD_INGEST_KEY && Date.now() - lastBeat > HEARTBEAT_MS) {
      lastBeat = Date.now();
      ctx.waitUntil(beat(env, request).catch(() => {}));
    }
    return response;
  },
};
`;
}

/** Ein Aufruf, mit dem der Kunde (oder Support) `verified` sofort ausloest. */
export function buildVerifyCommand(i: InstallerInput): string {
  const body = JSON.stringify({
    event: {
      event_type: HEARTBEAT_EVENT_TYPE,
      event_source: 'website_scanner',
      title: `Sensor heartbeat ${i.domain ?? 'manual'}`,
      risk_level: 'info',
      ...(i.assetId ? { asset_id: i.assetId } : {}),
      payload: { sensor: 'curl', version: 1 },
    },
  });
  return `curl -sS -X POST ${i.ingestUrl} -H "authorization: Bearer $RSD_INGEST_KEY" -H "content-type: application/json" -d '${body}'`;
}

// ─── Evidence-Chain ────────────────────────────────────────────────────────
// Snapshot nach der Konvention aus evidence-hash.ts: alles, was der Hash
// abdeckt, inklusive previous_hash, steht in metadata.snapshot.

export function lifecycleSnapshot(args: {
  tenantId: string;
  step: BootStepId | 'boot';
  action: string;
  detail: Record<string, unknown>;
  occurredAt: string;
  previousHash: string | null;
}): Record<string, unknown> {
  return {
    kind: 'tenant.lifecycle',
    tenant_id: args.tenantId,
    step: args.step,
    action: args.action,
    detail: args.detail,
    occurred_at: args.occurredAt,
    previous_hash: args.previousHash,
  };
}

/** Konstantzeit-Vergleich fuer den internen Service-Aufruf. */
export async function timingSafeEqualString(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
