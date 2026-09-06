/**
 * Lesbare Namen der Entitlement-Keys — nur für die Anzeige.
 *
 * Wer hier fehlt, wird mit seinem Key gezeigt, nicht verschwiegen. Die
 * Berechtigung selbst entscheidet `tenant_entitlements()`; diese Datei
 * beschriftet nur.
 */
import type { EntitlementKey } from '@/shared/pricing';

const KEY_LABELS: Partial<Record<EntitlementKey, string>> = {
  'ai.tool.automations': 'Automations-Skills',
  'ai.tool.bot_reply': 'KI-Antworten der Bots',
  'ai.tool.vps_action_advisor': 'Kodee Risiko-Advisor',
  'ai.tool.vps_status': 'Kodee Server-Status',
  'ai.tool.workflows': 'Workflow-Engine',
  'alerts.email': 'E-Mail-Alerts bei neuen Findings',
  'api.access': 'API-Zugriff',
  'bots.appointments': 'Terminbuchung über Bots',
  'bots.chat': 'Website-Chat',
  'bots.enabled': 'Governance-Bots',
  'bots.human_handoff': 'Übergabe an Menschen',
  'bots.multi_channel': 'Ein Bot, mehrere Kanäle',
  'bots.orders': 'Bestellannahme über Bots',
  'bots.voice': 'Sprachkanal (Voice)',
  'bots.whatsapp': 'WhatsApp-Kanal',
  'bulk.jobs': 'Bulk-Jobs',
  'c2pa.export': 'C2PA-Export',
  'compliance.export': 'Compliance-Export',
  'dashboard.access': 'Dashboard',
  'dse.generator': 'Generator für Datenschutzerklärung',
  'evidence.advanced': 'Evidence Vault (erweitert)',
  'evidence.basic_vault': 'Evidence Vault',
  'fix.snippets': 'Behebungsvorschläge mit Code',
  'governance.ai_register': 'KI-Register',
  'governance.dsgvo_directory': 'Verarbeitungsverzeichnis',
  'governance.risk_register': 'Risikoregister',
  'limit.ai_calls_monthly': 'KI-Aufrufe pro Monat',
  'limit.api_calls_monthly': 'API-Aufrufe pro Monat',
  'limit.automation_runs_monthly': 'Automationsläufe pro Monat',
  'limit.bot_messages_monthly': 'Bot-Antworten pro Monat',
  'limit.bot_voice_minutes_monthly': 'Voice-Minuten pro Monat',
  'limit.bots': 'Governance-Bots',
  'limit.bulk_jobs_monthly': 'Bulk-Jobs pro Monat',
  'limit.compliance_exports_monthly': 'Compliance-Exporte pro Monat',
  'limit.domains': 'Überwachte Domains',
  'limit.evidence_storage_gb': 'Evidence-Speicher (GB)',
  'limit.team_seats': 'Team-Plätze',
  'limit.whatsapp_conversations_monthly': 'WhatsApp-Konversationen pro Monat',
  'limit.workflow_runs_monthly': 'Workflow-Läufe pro Monat',
  'monitoring.daily': 'Tägliches Monitoring',
  'monitoring.drift': 'Drift-Erkennung',
  'monitoring.monthly': 'Monatliches Monitoring',
  'policy.iso27001': 'Policy Pack ISO 27001',
  'policy.nis2': 'Policy Pack NIS2',
  'policy.packs': 'Policy Packs',
  'provenance.advanced': 'Herkunftsnachweis (erweitert)',
  'reports.export': 'Berichte exportieren',
  'scheduler.enabled': 'Scheduler',
  'sla.priority': 'Priorisierter Support',
  'sso.enabled': 'SSO',
  'team.members': 'Team-Mitglieder',
  'webhooks.enabled': 'Webhooks',
  'website.scan': 'Website-Scan',
  'whitelabel.dashboard': 'White-Label-Dashboard',
  'whitelabel.reports': 'White-Label-Berichte',
};

export function entitlementLabel(key: string): string {
  return KEY_LABELS[key as EntitlementKey] ?? key;
}
