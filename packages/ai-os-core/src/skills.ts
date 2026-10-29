// Skill-Register — die zehn ersten Skills des internen AI-OS.
//
// Jeder Skill hat eine Claude-Code-kompatible Anleitung unter
// `.claude/skills/<id>/SKILL.md` (Aufruf in jeder Claude-Code-Sitzung mit
// `/<id>`, auch in Cloud-Sitzungen ohne lokalen PC). Wo ein deterministischer
// Teil serverseitig laufen kann, verweist `routineId` auf die Routine, die ihn
// ohne Modellaufruf ausführt. Skills kombinieren sich, indem ein Skill den
// Bericht eines anderen als Eingabe nimmt (siehe `inputs`).

import type { SkillDefinition } from './types.ts';

const skillFile = (id: string) => `.claude/skills/${id}/SKILL.md`;

export const SKILLS: readonly SkillDefinition[] = [
  {
    id: 'aios-pr-review',
    name: 'GitHub PR Review',
    skillFile: skillFile('aios-pr-review'),
    summary: 'Prüft einen Pull Request auf Korrektheit, Scope, Sicherheitsgrenzen und Repo-Regeln.',
    agent: 'development',
    inputs: [
      { name: 'pr', description: 'PR-Nummer im Repository', required: true },
      { name: 'focus', description: 'Optionaler Schwerpunkt (z. B. Sicherheit, UI)', required: false },
    ],
    outputs: [
      { name: 'findings', description: 'Befunde mit Datei:Zeile, Schweregrad und Begründung', required: true },
      { name: 'verdict', description: 'Empfehlung: mergebar / Änderungen nötig / blockiert', required: true },
    ],
    quality: [
      'Jeder Befund nennt einen realistischen Fehlerpfad, keine Stilmeinung als Blocker.',
      'Prüft CLAUDE.md-Verbote (Secrets, Service-Role im Browser, destruktive Migrationen).',
      'Kein Merge, kein Approve — nur Bericht.',
    ],
    actions: ['github.pulls.read', 'github.actions.read'],
    routineId: 'daily-github-status',
    status: 'preview',
  },
  {
    id: 'aios-ci-failure-analysis',
    name: 'CI Failure Analysis',
    skillFile: skillFile('aios-ci-failure-analysis'),
    summary: 'Ordnet fehlgeschlagene Checks ein: Ursache im PR, auf main oder Infrastruktur.',
    agent: 'development',
    inputs: [
      { name: 'run', description: 'Workflow-Lauf-ID oder PR-Nummer', required: true },
    ],
    outputs: [
      { name: 'diagnosis', description: 'Fehlgeschlagener Job/Schritt, Ursache, betroffene Dateien', required: true },
      { name: 'fix', description: 'Vorgeschlagene minimale Korrektur oder Begründung, warum nicht dieser PR', required: true },
    ],
    quality: [
      '„Flake" ist keine Ursache; ein Re-Run nur zur Bestätigung.',
      'Erst reproduzieren, dann Fix vorschlagen.',
      'Kein Test wird übersprungen oder deaktiviert.',
    ],
    actions: ['github.actions.read', 'github.pulls.read'],
    routineId: 'ci-failure-analysis',
    status: 'preview',
  },
  {
    id: 'aios-code-quality-audit',
    name: 'Code Quality Audit',
    skillFile: skillFile('aios-code-quality-audit'),
    summary: 'Prüft einen Pfad auf tote Pfade, Duplikate, fehlende Tests und Typ-Lücken.',
    agent: 'development',
    inputs: [
      { name: 'path', description: 'Verzeichnis oder Datei (z. B. src/features/admin)', required: true },
    ],
    outputs: [
      { name: 'report', description: 'Priorisierte Liste mit Aufwand/Nutzen je Punkt', required: true },
    ],
    quality: [
      'Nutzt npm run lint, npm test und npm run check:dead als Belege.',
      'Kandidaten aus check:dead sind keine Löschfreigabe.',
      'Keine Repo-weiten Refactors vorschlagen ohne Nutzenbeleg.',
    ],
    actions: ['github.contents.read'],
    status: 'preview',
  },
  {
    id: 'aios-security-audit',
    name: 'Security Audit',
    skillFile: skillFile('aios-security-audit'),
    summary: 'Prüft RLS, Edge-Function-Auth, Secrets-Handhabung und offene Sicherheits-PRs.',
    agent: 'infrastructure',
    inputs: [
      { name: 'scope', description: 'Edge Function, Migration oder Feature-Pfad', required: true },
    ],
    outputs: [
      { name: 'findings', description: 'Befunde mit Schweregrad, Ausnutzungspfad und Fix', required: true },
      { name: 'guards', description: 'Status von CodeQL und den Drift-Guards', required: true },
    ],
    quality: [
      'Tenant nur über JWT → memberships, nie aus Body/URL.',
      'verify_jwt=false nur für Webhooks/OAuth-Callbacks mit eigener Signaturprüfung.',
      'Keine Secrets oder personenbezogenen Daten im Bericht.',
    ],
    actions: ['github.actions.read', 'github.pulls.read', 'github.contents.read'],
    routineId: 'security-infra-check',
    status: 'preview',
  },
  {
    id: 'aios-compliance-verification',
    name: 'Compliance Feature Verification',
    skillFile: skillFile('aios-compliance-verification'),
    summary: 'Vergleicht Produktversprechen mit Code und Belegen (implementation-status.ts).',
    agent: 'compliance',
    inputs: [
      { name: 'claim', description: 'Feature-ID aus implementation-status.ts oder Landing-Aussage', required: true },
    ],
    outputs: [
      { name: 'evidence', description: 'Belegte Dateien, Tests, Routen — oder fehlender Beleg', required: true },
      { name: 'status', description: 'Empfohlener Status live / preview / coming-soon', required: true },
    ],
    quality: [
      'Keine Claims „vollständig revisionssicher", „autonome Agenten live", „EU-konform garantiert".',
      'Status nur aus src/product/implementation-status.ts ableiten.',
      'Rechtliche Einordnung ist Hinweis, keine Rechtsberatung.',
    ],
    actions: ['github.contents.read'],
    routineId: 'claims-evidence-check',
    status: 'preview',
  },
  {
    id: 'aios-dashboard-review',
    name: 'Dashboard Quality Review',
    skillFile: skillFile('aios-dashboard-review'),
    summary: 'Prüft eine App-Fläche auf echte Datenquellen, Empty States, Bedienbarkeit und Responsivität.',
    agent: 'development',
    inputs: [
      { name: 'route', description: 'Route, z. B. /app/dashboard oder /admin/ai-os', required: true },
    ],
    outputs: [
      { name: 'report', description: 'Je Element: Quelle, Zustand (echt/leer/Fehler), Barrierefreiheit', required: true },
    ],
    quality: [
      'Keine Fake-KPIs: jede Zahl auf eine Quelle rückführbar (check:fabrication, check:dashboard).',
      'Jeder Button tut etwas oder ist ehrlich als Preview beschriftet.',
      'Prüfung bei 375 px, 768 px und 1280 px Breite.',
    ],
    actions: ['github.contents.read'],
    status: 'preview',
  },
  {
    id: 'aios-business-report',
    name: 'Business Report Generation',
    skillFile: skillFile('aios-business-report'),
    summary: 'Erstellt einen Geschäftsbericht aus belegten Quellen (Stripe, Kosten-Ledger, Entwicklungsbericht).',
    agent: 'business-ops',
    inputs: [
      { name: 'period', description: 'Zeitraum, z. B. 2026-10 oder KW 42', required: true },
    ],
    outputs: [
      { name: 'report', description: 'Bericht mit Quellenangabe je Zahl; fehlende Quellen als Lücke benannt', required: true },
    ],
    quality: [
      'Keine geschätzten Zahlen als Messwert; Schätzungen klar markiert.',
      'Keine Kundennamen oder personenbezogenen Daten im Repository.',
      'Software-Kosten nur aus Rechnungen/Ledger, nicht aus Listenpreisen.',
    ],
    actions: ['stripe.read', 'supabase.costs.read', 'google.read'],
    status: 'preview',
  },
  {
    id: 'aios-documentation-update',
    name: 'Documentation Update',
    skillFile: skillFile('aios-documentation-update'),
    summary: 'Hält Doku nach einer Codeänderung aktuell — innerhalb des Kontextbudgets.',
    agent: 'knowledge',
    inputs: [
      { name: 'change', description: 'PR-Nummer oder geänderte Pfade', required: true },
    ],
    outputs: [
      { name: 'diff', description: 'Doku-Änderung als PR, mit Begründung je Datei', required: true },
    ],
    quality: [
      'npm run check:context bleibt grün; Budget nie anheben.',
      'Bestehende Dokumente aktualisieren statt neue anlegen.',
      'CLAUDE.md bleibt kurz (keine Messprotokolle).',
    ],
    actions: ['github.contents.read', 'github.pr.prepare'],
    routineId: 'docs-control',
    status: 'preview',
  },
  {
    id: 'aios-release-readiness',
    name: 'Release Readiness Check',
    skillFile: skillFile('aios-release-readiness'),
    summary: 'Stellt fest, ob main deploybar ist: CI, Drift-Guards, offene Sicherheits-PRs, Migrationen.',
    agent: 'infrastructure',
    inputs: [
      { name: 'ref', description: 'Commit oder Branch (Standard: main)', required: false },
    ],
    outputs: [
      { name: 'checklist', description: 'Go/No-Go je Kriterium mit Beleg', required: true },
    ],
    quality: [
      'Deploy selbst bleibt ein separater, menschlicher Schritt.',
      'Migrationen werden als eigener Freigabepunkt ausgewiesen.',
      'npm run merge:hygiene und check:production als Belege.',
    ],
    actions: ['github.actions.read', 'github.pulls.read', 'cloudflare.deploy.read'],
    routineId: 'security-infra-check',
    status: 'preview',
  },
  {
    id: 'aios-knowledge-update',
    name: 'Knowledge Base Update',
    skillFile: skillFile('aios-knowledge-update'),
    summary: 'Pflegt die Wissensbasis docs/ai-os: Entscheidungen erfassen, verknüpfen, Prüfdatum setzen.',
    agent: 'knowledge',
    inputs: [
      { name: 'source', description: 'Entscheidung, PR, ADR oder Notiz', required: true },
    ],
    outputs: [
      { name: 'note', description: 'Aktualisierte Wissensnotiz mit Frontmatter (owner, reviewed)', required: true },
    ],
    quality: [
      'Keine privaten Dokumente, Fallakten, Passwörter oder Schlüssel im Repository.',
      'Verlinken statt kopieren: Quelle der Wahrheit bleibt die Code-/Doku-Datei.',
      'Änderung nur per PR (Versionierung über Git).',
    ],
    actions: ['github.contents.read', 'github.knowledge.propose'],
    routineId: 'docs-control',
    status: 'preview',
  },
];

export function getSkill(id: string): SkillDefinition | undefined {
  return SKILLS.find((s) => s.id === id);
}
