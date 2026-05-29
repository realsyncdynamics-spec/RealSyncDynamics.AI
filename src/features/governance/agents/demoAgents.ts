import type { GovernanceAgent } from './types';

/**
 * Initial-Set der sechs Governance-Agenten. Diese Liste ist Single Source
 * of Truth fuer die kontrollierte Sicht auf alle Agenten. Erweiterungen
 * MUSS jemand explizit anpassen — kein impliziter Default-Constructor.
 */
export const DEMO_AGENTS: GovernanceAgent[] = [
  {
    id: 'agent-drift',
    name: 'Website Drift Agent',
    type: 'detection',
    status: 'active',
    riskLevel: 'medium',
    tools: ['headless_browser', 'har_capture', 'consent_scanner', 'tracker_db_lookup'],
    permissions: ['read:domain_scans', 'write:drift_events', 'read:tenant_baseline'],
    restrictedActions: [
      'andert_kunden_websites_nicht',
      'spricht_keine_aufsichtsbehoerde_an',
      'sendet_keine_emails_an_endkunden',
    ],
    requiresHumanReview: [
      'klassifikation_neuer_anbieter',
      'eskalation_drift_zu_critical',
    ],
    lastRunAt: '2026-05-20T06:14:00.000Z',
    ownerRole: 'governance.owner',
    evidenceRefs: ['ev:drift:tenant-x:run-2026-05-20'],
    description:
      'Erkennt neue Pre-Consent-Tracker, geaenderte CMP-Konfigurationen und neue Drittanbieter '
      + 'gegenueber dem Tenant-Baseline.',
  },
  {
    id: 'agent-ai-risk',
    name: 'AI Risk Agent',
    type: 'classification',
    status: 'review_required',
    riskLevel: 'high',
    tools: ['ai_endpoint_inventory', 'use_case_questionnaire', 'risk_class_engine'],
    permissions: ['read:ai_inventory', 'write:risk_classifications'],
    restrictedActions: [
      'gibt_keine_rechtsverbindliche_einstufung_ab',
      'meldet_nicht_an_aufsicht',
      'aktiviert_oder_deaktiviert_ki_systeme_nicht',
    ],
    requiresHumanReview: [
      'einstufung_als_high_risk',
      'einstufung_als_prohibited',
      'frei_text_use_case_klassifikation',
    ],
    lastRunAt: '2026-05-19T22:01:00.000Z',
    ownerRole: 'compliance.lead',
    evidenceRefs: ['ev:ai-risk:tenant-x:weekly'],
    description:
      'Sortiert erkannte KI-Endpunkte in die AI-Act-Risiko-Klassen (minimal / limited / high / '
      + 'prohibited) und kennzeichnet Faelle, die fachliche Pruefung erfordern.',
  },
  {
    id: 'agent-evidence',
    name: 'Evidence Agent',
    type: 'evidence',
    status: 'active',
    riskLevel: 'low',
    tools: ['hash_chain_writer', 'evidence_packager', 'signature_engine'],
    permissions: ['write:evidence_vault', 'read:audit_runs'],
    restrictedActions: [
      'manipuliert_historische_evidence_nicht',
      'oeffnet_keine_externen_endpunkte',
      'gibt_evidence_nicht_ohne_freigabe_weiter',
    ],
    requiresHumanReview: [
      'evidence_export_an_externe_dritte',
    ],
    lastRunAt: '2026-05-20T07:00:00.000Z',
    ownerRole: 'governance.owner',
    evidenceRefs: ['ev:evidence-agent:self-check'],
    description:
      'Bewahrt Audit-Befunde, Reviews und Freigabe-Entscheidungen in einer Hash-Chain auf. '
      + 'Erzeugt signierte Exporte fuer DSB / Aufsicht.',
  },
  {
    id: 'agent-policy',
    name: 'Policy Agent',
    type: 'policy',
    status: 'active',
    riskLevel: 'medium',
    tools: ['policy_engine', 'rule_lint', 'rule_diff'],
    permissions: ['read:policies', 'evaluate:policies'],
    restrictedActions: [
      'aendert_keine_aktiven_policies_ohne_review',
      'gibt_keine_anwaltliche_auslegung_ab',
    ],
    requiresHumanReview: [
      'policy_aenderung_publish',
      'konflikt_zwischen_zwei_policies',
    ],
    lastRunAt: '2026-05-20T05:30:00.000Z',
    ownerRole: 'compliance.lead',
    evidenceRefs: ['ev:policy-agent:rule-evaluations'],
    description:
      'Bewertet Runtime-Events gegen das aktive Regelwerk (z. B. „kein Tracker vor Consent") '
      + 'und erzeugt klassifizierte Findings.',
  },
  {
    id: 'agent-triage',
    name: 'Triage Agent',
    type: 'triage',
    status: 'active',
    riskLevel: 'low',
    tools: ['finding_router', 'severity_estimator', 'duplicate_collapse'],
    permissions: ['read:findings', 'write:finding_routing'],
    restrictedActions: [
      'schliesst_keine_findings_eigenstaendig',
      'unterdrueckt_keine_evidence',
      'kommuniziert_nicht_mit_endkunden',
    ],
    requiresHumanReview: [
      'eskalation_in_aktiven_incident',
    ],
    lastRunAt: '2026-05-20T06:55:00.000Z',
    ownerRole: 'governance.owner',
    evidenceRefs: ['ev:triage-agent:routing-log'],
    description:
      'Sortiert eingehende Findings nach Schweregrad, fasst Duplikate zusammen und routet '
      + 'sie an die zustaendige Rolle.',
  },
  {
    id: 'agent-remediation',
    name: 'Developer Remediation Agent',
    type: 'remediation',
    status: 'paused',
    riskLevel: 'high',
    tools: ['code_snippet_generator', 'pr_drafter', 'fix_template_library'],
    permissions: ['read:findings', 'draft:pull_requests'],
    restrictedActions: [
      'mergt_keine_pull_requests_eigenstaendig',
      'fuehrt_keine_deploys_aus',
      'aktiviert_keine_production_aenderung',
    ],
    requiresHumanReview: [
      'jeder_vorschlag_vor_merge',
      'jede_code_aenderung_in_produktivem_repository',
    ],
    lastRunAt: null,
    ownerRole: 'developer.lead',
    evidenceRefs: [],
    description:
      'Schlaegt Code-Snippets und PR-Entwuerfe fuer typische Findings vor (z. B. GTM-Tag '
      + 'sperren bis Consent). Mergt nie selbst — alles bleibt Vorschlag.',
  },
];
