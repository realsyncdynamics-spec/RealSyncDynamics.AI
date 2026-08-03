import type { GovernanceModule, ModuleGate } from './governanceBrowserTypes';
import {
  PLAN_ORDER,
  planById,
  hasModule,
  hasPermission,
  limitOf,
  planRank,
  resolvePlan,
  type PlanId,
} from '@/shared/pricing';

/**
 * Navigations-Module des Governance-Workspace.
 *
 * ⚠️  Kein Modul führt eine eigene Plan-Liste. Der Zugriff wird über ein
 *     `gate` aus der Pricing-SSoT abgeleitet (`shared/pricing.ts`) — sonst
 *     driften Navigation und Pricing auseinander, was vor diesem Refactoring
 *     nachweislich passiert ist (z.B. war der Evidence Vault im Pricing ab
 *     Starter enthalten, in der Navigation aber erst ab Agency sichtbar).
 *
 * Gate-Arten:
 *   all         — für jeden Plan sichtbar (Konto-, Übersichts- und Free-Audit-Flächen)
 *   module      — Modul muss im Plan freigeschaltet sein
 *   permission  — Berechtigung muss im Plan gesetzt sein
 *   limit       — numerisches Limit muss mindestens `min` betragen
 */
export const GOVERNANCE_MODULES: GovernanceModule[] = [
  {
    id: 'overview',
    label: 'Übersicht',
    icon: 'Home',
    route: '/app',
    status: 'live',
    gate: { kind: 'all' },
    description: 'Zentrale Governance-Übersicht',
  },
  {
    id: 'home',
    label: 'Workspace',
    icon: 'LayoutDashboard',
    route: '/app/home',
    status: 'live',
    gate: { kind: 'all' },
    description: 'Echtzeit-Workspace mit Live-Daten (Auth erforderlich)',
  },
  {
    id: 'websites',
    label: 'Websites',
    icon: 'Globe',
    route: '/app/websites',
    status: 'live',
    gate: { kind: 'all' },
    description: 'Website-Governance, Scans und Findings',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    icon: 'FileCheck2',
    route: '/app/evidence',
    status: 'live',
    gate: { kind: 'all' },
    description: 'Hashes, Snapshots und Prüfpfade (read-only im Free Audit)',
  },
  {
    id: 'ai-systems',
    label: 'KI-Systeme',
    icon: 'Cpu',
    route: '/app/ai-systems',
    status: 'beta',
    gate: { kind: 'module', module: 'eu_ai_act' },
    description: 'KI-System-Registry und EU-AI-Act-Dokumentation',
  },
  {
    id: 'risks',
    label: 'Risiken',
    icon: 'AlertTriangle',
    route: '/app/risks',
    status: 'beta',
    gate: { kind: 'module', module: 'risk_register' },
    description: 'Risikoidentifikation und Priorisierung',
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: 'Activity',
    route: '/app/monitoring',
    status: 'beta',
    gate: { kind: 'module', module: 'monitoring' },
    description: 'Laufende Überwachung von Assets und Kontrollen',
  },
  {
    id: 'security-signals',
    label: 'Security Signals',
    icon: 'ShieldAlert',
    route: '/app/security-signals',
    status: 'beta',
    gate: { kind: 'module', module: 'monitoring' },
    description: 'Sicherheitssignale und Auffälligkeiten',
  },
  {
    id: 'vendors',
    label: 'Dienstleister',
    icon: 'Building2',
    route: '/app/vendors',
    status: 'beta',
    gate: { kind: 'module', module: 'policy_engine' },
    description: 'Auftragsverarbeiter und Drittparteienrisiko',
  },
  {
    id: 'reports',
    label: 'Berichte',
    icon: 'BarChart3',
    route: '/app/reports',
    status: 'beta',
    gate: { kind: 'module', module: 'compliance_reports' },
    description: 'Compliance-Berichte je Rahmenwerk',
  },
  {
    id: 'dpia',
    label: 'DSFA',
    icon: 'FileSearch',
    route: '/app/dpia',
    status: 'roadmap',
    gate: { kind: 'module', module: 'policy_engine' },
    description: 'Datenschutz-Folgenabschätzung',
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: 'Bell',
    route: '/app/alerts',
    status: 'beta',
    gate: { kind: 'module', module: 'alerts' },
    description: 'Benachrichtigungen bei neuen Findings',
  },
  {
    id: 'remediation',
    label: 'Maßnahmen',
    icon: 'Wrench',
    route: '/app/remediation',
    status: 'roadmap',
    gate: { kind: 'module', module: 'remediation' },
    description: 'Behebungspläne und Fortschrittsverfolgung',
  },
  {
    id: 'billing',
    label: 'Abrechnung',
    icon: 'CreditCard',
    route: '/app/billing',
    status: 'live',
    gate: { kind: 'all' },
    description: 'Plan, Rechnungen und Zahlungsmittel',
  },
  {
    id: 'team',
    label: 'Team',
    icon: 'Users',
    route: '/app/team',
    status: 'live',
    gate: { kind: 'limit', limit: 'seats', min: 2 },
    description: 'Mitglieder, Rollen und Einladungen',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: 'GitBranch',
    route: '/app/workflows',
    status: 'live',
    gate: { kind: 'module', module: 'workflows' },
    description: 'Mehrstufige Governance-Abläufe mit Freigaben',
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: 'Bot',
    route: '/app/agents',
    status: 'live',
    gate: { kind: 'all' },
    description: 'Governance-Agents und ihre Läufe',
  },
  {
    id: 'bots',
    label: 'Bots',
    icon: 'MessageSquare',
    route: '/app/bots',
    status: 'live',
    gate: { kind: 'module', module: 'ai_bots' },
    description: 'Governance-Bots über alle Kanäle',
  },
  {
    id: 'automations',
    label: 'Automationen',
    icon: 'Zap',
    route: '/app/automations',
    status: 'live',
    gate: { kind: 'module', module: 'automation_engine' },
    description: 'Automationsläufe und Skills',
  },
  {
    id: 'kodee',
    label: 'Kodee',
    icon: 'Terminal',
    route: '/kodee',
    status: 'live',
    gate: { kind: 'module', module: 'kodee' },
    description: 'Server-Operations-Assistent per SSH',
  },
  {
    id: 'provenance',
    label: 'Herkunftsnachweis',
    icon: 'BadgeCheck',
    route: '/app/provenance',
    status: 'live',
    gate: { kind: 'permission', permission: 'provenanceSigning' },
    description: 'Signatur, Chain-of-Custody und Trust-Score',
  },
  {
    id: 'bulk',
    label: 'Bulk Jobs',
    icon: 'Layers',
    route: '/app/bulk',
    status: 'live',
    gate: { kind: 'permission', permission: 'bulkOperations' },
    description: 'Massenläufe über viele Domains',
  },
  {
    id: 'scheduler',
    label: 'Scheduler',
    icon: 'CalendarClock',
    route: '/app/scheduler',
    status: 'live',
    gate: { kind: 'permission', permission: 'scheduler' },
    description: 'Geplante Läufe und Alarmierung',
  },
  {
    id: 'evidence-vault',
    label: 'Evidence Vault',
    icon: 'Archive',
    route: '/app/evidence-vault',
    status: 'live',
    gate: { kind: 'permission', permission: 'evidenceVault' },
    description: 'Unveränderliche Snapshots, Retention und Legal Hold',
  },
  {
    id: 'policy-packs',
    label: 'Policy Packs',
    icon: 'Scale',
    route: '/app/policy-packs',
    status: 'live',
    gate: { kind: 'module', module: 'dsgvo' },
    description: 'Aktive Rahmenwerke des Plans verwalten',
  },
  {
    id: 'documents',
    label: 'Dokumente',
    icon: 'FileText',
    route: '/app/documents',
    status: 'live',
    gate: { kind: 'all' },
    description: 'Erzeugte Dokumente und Nachweise',
  },
  {
    id: 'audit',
    label: 'Audit Center',
    icon: 'ClipboardCheck',
    route: '/app/audit',
    status: 'live',
    gate: { kind: 'module', module: 'audit_center' },
    description: 'Prüfpfad, Audit-Läufe und Exporte',
  },
  {
    id: 'settings',
    label: 'Einstellungen',
    icon: 'Settings',
    route: '/app/settings',
    status: 'live',
    gate: { kind: 'all' },
    description: 'Konto, Sicherheit und Integrationen',
  },
];

/** Alle nicht-Roadmap-Module für die Tab-Leiste. */
export const TAB_MODULES = GOVERNANCE_MODULES.filter(
  (m) => m.status === 'live' || m.status === 'beta',
);

/** Roadmap-Module für den More-Dock. */
export const DOCK_MODULES = GOVERNANCE_MODULES.filter(
  (m) => m.status === 'roadmap',
);

/** Wertet ein Gate gegen einen konkreten Plan aus. */
function gateAllows(gate: ModuleGate, planId: PlanId): boolean {
  switch (gate.kind) {
    case 'all':
      return true;
    case 'module':
      return hasModule(planId, gate.module);
    case 'permission':
      return hasPermission(planId, gate.permission);
    case 'limit': {
      const value = limitOf(planId, gate.limit);
      return value === -1 || value >= gate.min;
    }
  }
}

/**
 * Die Pläne, die auf ein Modul zugreifen dürfen — abgeleitet, nicht gepflegt.
 */
export function plansForModule(module: GovernanceModule): PlanId[] {
  return PLAN_ORDER.filter((planId) => gateAllows(module.gate, planId));
}

/**
 * Hat `userPlan` Zugriff auf das Modul?
 * Akzeptiert PlanId, Plan-Key und Altdaten (`scale` → `partner`).
 * Unbekannte Pläne erhalten keinen Zugriff — defensiver Default.
 */
export function canAccessModule(module: GovernanceModule, userPlan: string | null | undefined): boolean {
  const plan = resolvePlan(userPlan);
  if (!plan) return false;
  return gateAllows(module.gate, plan.id);
}

/**
 * Mindest-Plan für ein Modul (niedrigster Plan nach kanonischer Reihenfolge,
 * der das Gate erfüllt). Liefert `enterprise`, wenn kein Plan es erfüllt —
 * dieser Fall sollte durch den Konsistenztest ausgeschlossen sein.
 */
export function minimumPlanForModule(module: GovernanceModule): PlanId {
  const allowed = plansForModule(module);
  return allowed.length > 0 ? allowed[0] : 'enterprise';
}

/** Anzeigename des Mindest-Plans, z.B. für Upgrade-Hinweise. */
export function minimumPlanLabelForModule(module: GovernanceModule): string {
  return planById(minimumPlanForModule(module)).name;
}

/** Sortierrang eines Plans — Re-Export für Navigations-Logik. */
export { planRank };
