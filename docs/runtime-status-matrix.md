# Runtime Status Matrix

> **Single Source of Truth** für den Reifegrad jedes Moduls der RealSyncDynamics.AI Governance Runtime.
>
> Diese Matrix ist verbindlich für Website, Pitch Deck, Investor Docs, Enterprise Sales, Compliance Briefings und technische Dokumentation. Wenn ein Modul hier nicht als 🟢 markiert ist, darf es in externer Kommunikation nicht als produktiv beworben werden.

---

## Warum diese Matrix existiert

Wir bauen eine **Governance-Infrastruktur**, kein experimentelles AI-Produkt. Enterprise-Kunden, Regulatoren und Investoren bewerten unsere Glaubwürdigkeit daran, wie sauber wir trennen zwischen:

- **was produktiv ist** (heute belastbar, mit Evidenz)
- **was beta ist** (technisch funktionsfähig, aber eingeschränkt / nicht audit-fest)
- **was roadmap ist** (geplant, noch nicht implementiert)
- **was Vision ist** (Zielarchitektur, nicht Versprechen)

Vision ≠ Produktstatus. Diese Trennung muss überall sichtbar bleiben.

---

## Legende

| Symbol | Status | Bedeutung |
|---|---|---|
| 🟢 | **produktiv** | In Produktion, durch Tests/Telemetrie/Evidence-Records belegbar, audit-fest. Darf in Enterprise-Kommunikation und Marketing genannt werden. |
| 🟡 | **beta** | Technisch funktionsfähig, aber eingeschränkter Scope, unvollständige Evidence-Kette oder fehlende externe Validierung. Nur unter ausdrücklicher Kennzeichnung als "Beta" / "Early Access" kommunizierbar. |
| 🔴 | **roadmap** | Geplant, spezifiziert oder im PoC. **Nicht** als Produktfunktion kommunizierbar. Darf in Vision-Abschnitten erwähnt werden, klar getrennt vom Produktscope. |
| ⚪ | **vision** | Strategisches Ziel ohne Implementierungs-Commitment. Erscheint nur in Blueprint-/Architecturdokumenten, nie in Sales-Material. |

### Reifegrad-Detail

Ergänzend zum Status:

- **Scope**: was das Modul abdeckt — und was bewusst **nicht**
- **Evidence**: ob Audit-Trail / hashed records existieren
- **Human Review**: ob ein Approval-Gate vorhanden ist
- **Externe Validierung**: ob unabhängig auditiert / pen-getestet / zertifiziert

---

## Hauptmatrix

> Jede Zeile mit `(?)` bedeutet: vom Repo-Stand abgeleitet, vom Produkt-Lead zu bestätigen.

### Detection & Discovery

| Modul | Status | Reifegrad | Evidence | Anmerkung / zu validieren |
|---|---|---|---|---|
| Cookie / Tracker Scan (server-side fetch) | 🟢 (?) | produktiv | append-only `gdpr_audits` | `cookie-scan` Edge Function live |
| Deep Cookie Scan (Playwright) | 🟡 (?) | beta | partial | `cookie-scan-deep` + `services/playwright-scanner` — laut ROADMAP Deployment ausstehend |
| Browser Detection (Extension) | 🟡 (?) | beta | client-side | drei parallele Extensions (`extension/`, `extension-governance/`, `extension-ai-monitor/`) — Konsolidierungsbedarf |
| Consent Detection / Reject-Equivalence | 🟡 (?) | beta | UI-only | laut `findings-2026-05-14.md` Befund #3 noch offen |
| Vendor / Sub-Processor Inventory | 🟡 (?) | beta | unvollständig | laut Findings #6 noch nicht vollständig erfasst |
| Vendor Drift Detection | 🔴 | roadmap | – | im Blueprint spezifiziert, noch nicht implementiert |
| AI Asset Discovery (Cloud Connectors / CI Hooks) | 🔴 | roadmap | – | Blueprint §2.1 DISCOVER, noch nicht gebaut |

### Classification & Risk

| Modul | Status | Reifegrad | Evidence | Anmerkung / zu validieren |
|---|---|---|---|---|
| Rule Engine (DSGVO / AI-Act statisch) | 🟢 (?) | produktiv | versionierte Rules | `_shared/rules/evaluator.ts` + `gdpr.json` + `ai-act.json` |
| AI-Act Classification (regelbasiert) | 🟡 (?) | beta, eingeschränkt | partial | `ai-act-classify` Edge Function — Klassifikation regelbasiert, **keine** rechtsverbindliche Einstufung |
| AI-Act Classification (lernend / kontextuell) | 🔴 | roadmap | – | – |
| Risk Score | 🟡 (?) | beta | partial | `governance-risk-score` Edge Function — Score-Modell intern, nicht extern validiert |

### Policy & Enforcement

| Modul | Status | Reifegrad | Evidence | Anmerkung / zu validieren |
|---|---|---|---|---|
| Policy-as-Code (OPA/Rego) | 🔴 | roadmap | – | Blueprint §1 Prinzip #8, noch nicht implementiert |
| Runtime Enforcement (allow/warn/block) | 🔴 | roadmap | – | – |
| Approval Queue / Human Review | 🟡 (?) | beta | partial | `governance-approvals` Edge Function vorhanden, Workflow-Reife zu prüfen |

### Evidence & Audit

| Modul | Status | Reifegrad | Evidence | Anmerkung / zu validieren |
|---|---|---|---|---|
| Audit Log (append-only) | 🟢 (?) | produktiv | ja | bestehende Tabellenstruktur mit RLS |
| Evidence Vault (hashed records) | 🟡 (?) | beta | partial | `evidence-vault-export` Edge Function — Hash-Kette noch nicht vollständig spezifiziert |
| Evidence Export (Audit-Paket) | 🟡 (?) | beta | partial | `evidence-export` + `audit-report-pdf` |
| Immutable Storage / WORM | 🔴 | roadmap | – | – |
| Replay Engine | 🔴 | roadmap | – | – |

### Remediation

| Modul | Status | Reifegrad | Evidence | Anmerkung / zu validieren |
|---|---|---|---|---|
| Remediation Hinweise (manuell umsetzbar) | 🟢 (?) | produktiv | im Report | Audit-Report enthält priorisierte Hinweise |
| Auto-Fix Empfehlungen (UI-gestützt) | 🟡 (?) | beta | – | laut ROADMAP Growth-Plan-Feature |
| Autonomous Remediation (Agent-driven) | 🔴 | roadmap | – | – |

### Workflows (DPIA, DSR, Incident, Vendor Review)

| Modul | Status | Reifegrad | Evidence | Anmerkung / zu validieren |
|---|---|---|---|---|
| DSGVO-Datenexport (Art. 15) | 🟢 (?) | produktiv | audit-log | `gdpr-export` |
| DSGVO-Löschung (Art. 17) | 🟢 (?) | produktiv | audit-log | `gdpr-delete` |
| DPIA Workflow | 🟡 (?) | beta | partial | `governance-dpias` |
| Incident Workflow | 🔴 | roadmap | – | – |
| Vendor Review Workflow | 🔴 | roadmap | – | – |

### Agent Runtime

| Modul | Status | Reifegrad | Evidence | Anmerkung / zu validieren |
|---|---|---|---|---|
| Governance Agent (Ingest + Routing) | 🟡 (?) | beta | partial | `governance-agent`, `governance-ingest`, `services/openclaw-agent` |
| Agent Contract Specification (ACS) | 🔴 | roadmap | – | Spezifikation steht aus |
| Event Schema Standard (ESS) | 🔴 | roadmap | – | Spezifikation steht aus |
| Runtime Contract Specification (RCS) | 🔴 | roadmap | – | Spezifikation steht aus |

### Plattform / Querschnitt

| Modul | Status | Reifegrad | Evidence | Anmerkung / zu validieren |
|---|---|---|---|---|
| Multi-Tenancy (RLS auf `tenant_id`) | 🟢 (?) | produktiv | RLS-Policies | bestehend |
| Auth / RBAC | 🟢 (?) | produktiv | – | Supabase Auth, Owner/Admin/Editor/Viewer |
| EU-Hosting (Supabase eu-central) | 🟢 (?) | produktiv | – | Primärregion EU |
| EU-lokale AI-Inferenz (opt-in) | 🟡 (?) | beta | – | Ollama qwen3:4b auf Hostinger DE |
| Security Headers (HSTS, X-Frame, CSP) | 🟡 | beta | partial | Findings #1, #2, #4 — Härtung in Arbeit |
| Externe Sicherheits-Auditierung | 🔴 | roadmap | – | noch keine externe Pentest-/Compliance-Auditierung |
| SOC 2 / ISO 27001 | 🔴 | roadmap | – | – |
| AI-Act Konformitätsbewertung (extern) | 🔴 | roadmap | – | – |

---

## Sprach-Leitlinie

Die Matrix ist Grundlage. Die folgenden Regeln gelten überall, wo wir nach außen kommunizieren.

### Erlaubte Formulierungen

- "unterstützt Governance-Prozesse"
- "liefert revisionsfähige Evidenz"
- "automatisiert die technische Erkennung von …"
- "unterstützt die Audit-Vorbereitung"
- "stellt Runtime-Signale bereit"
- "ermöglicht kontinuierliches Monitoring"
- "Hinweise auf potenzielle Verstöße gegen …"

### Verboten — solange keine externe Validierung vorliegt

- "garantiert DSGVO-Compliance"
- "macht Unternehmen AI-Act-konform"
- "ersetzt den/die Datenschutzbeauftragte:n"
- "vollautomatische Rechtsprüfung"
- "AI entscheidet rechtlich"
- "autonome Compliance"
- "AI-Act-zertifiziert"
- "regulatorisch abgesichert"

Diese Liste ist nicht abschließend. Im Zweifel gilt: **unterstützt** statt **garantiert**.

---

## Pflege

- **Owner**: Produkt-Lead.
- **Update-Trigger**: jede Status-Änderung eines Moduls (PR, Release, Audit-Ergebnis).
- **Review-Kadenz**: vor jedem Investor-Update, vor jedem Enterprise-Pitch, vor jeder externen Veröffentlichung.
- **Konflikt-Regel**: bei Widerspruch zwischen Matrix und anderem Dokument (Website, Deck, README, ROADMAP, Blueprint) **gewinnt die Matrix**. Das andere Dokument ist zu korrigieren.

### Wo diese Matrix gespiegelt wird

- README (Statussäule)
- Pitch Deck (Reifegrad-Slide)
- Enterprise One-Pager
- `docs/architecture/governance-os-blueprint.md` (Vision-Abschnitt verweist auf Matrix für Ist-Stand)
- `ROADMAP.md` (Phasen referenzieren Matrix-Zeilen)

---

## Offene Validierungen

Diese Felder muss der Produkt-Lead in einem ersten Durchgang bestätigen oder korrigieren — alle mit `(?)` markierten Zeilen oben.

Empfohlenes Vorgehen: pro Zeile eine der drei Aktionen:

1. **bestätigen** → `(?)` entfernen
2. **runterstufen** → Status anpassen, `(?)` entfernen
3. **belegen** → Link auf Evidence-Record / Audit-Ergebnis / Test-Suite ergänzen, `(?)` entfernen

Erst danach darf die Matrix in externer Kommunikation referenziert werden.
