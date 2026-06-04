# RealSyncDynamics.AI — Architektur

Basis-Repository der **Realtime Governance Runtime**: jedes Business-Event wird
zu einem Governance-Event mit Evidence, Severity und (wenn nötig) Remediation.

> **Kanonische Positionierung & Scope:** `docs/PRODUCT_FOCUS.md`. Reifegrad pro
> Modul: `docs/runtime-status-matrix.md`. Diese beiden Dokumente sind
> verbindlich; bei Widersprüchen gewinnen sie. C2PA / Creator-Provenienz ist
> bewusst **nicht** Kern.

## 🗺 Ordner-Architektur (Feature-Sliced Design)

Damit das Projekt auch mit hunderten Komponenten und Ansichten skalierbar und maintainable bleibt, nutzen wir ein Domain-Driven / Feature-Sliced Design.

### Struktur
- \`/extension/\`: Der vollständige Code für die Chrome Extension (Manifest V3, Service Workers, React Sidebar).
- \`/src/core/\`: Framework-agnostische Geschäftslogik. Governance-Kern in
  \`/src/core/runtime/\` (Event-Schema, Evidence-Chain, Agent-Contracts,
  Remediation), dazu API-Gateways (\`ai-gateway\`), Entitlements und Auth-Logik.
- \`/src/features/\`: Die Domänen der Anwendung. Alles, was zu einem Feature gehört (z.B. UI, Modale, lokale State-Hooks) liegt hier extrem nah beieinander, z.B.:
  - \`/features/governance/\`, \`/features/audit/\`, \`/features/ai-governance/\` (Kern)
  - \`/features/workflows/\` (Connector-getriebene Automation)
  - \`/features/billing/\`, \`/features/settings/\`, \`/features/tenants/\`
- \`/src/components/\`: Allgemeine / Globale UI Komponenten (Landingpage-Sections, Buttons).
- \`/src/pages/\`: Reines Routing und Struktur, welche die Features auf den Bildschirmen zu einer Ansicht orchestriert (z.B. Governance-Leitstand, Audit-Dashboard).

## 🚀 Status

Reifegrad pro Modul ist **verbindlich** in `docs/runtime-status-matrix.md`
gepflegt (🟢 produktiv / 🟡 beta / 🔴 roadmap / ⚪ vision). Nur dort als 🟢
markierte Module dürfen extern als produktiv kommuniziert werden.

Phasen-Roadmap (Audit → Remediation → CMS → Continuous Compliance): `ROADMAP.md`.
Aktuell: **Phase A — Runtime härten** (Event-Schema, Evidence-Hashing,
Agent-Contracts, Remediation-Layer).
