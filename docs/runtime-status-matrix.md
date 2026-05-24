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

### Caveats: was 🟢 **nicht** bedeutet

Auch ein als 🟢 markiertes Modul ist nicht automatisch:

- extern auditiert / zertifiziert
- rechtsverbindlich (z.B. ist eine regelbasierte AI-Act-Klassifikation **keine** rechtsverbindliche Einstufung)
- frei von offenen Findings — siehe Spalte „Belege / Caveats"

Wenn ein 🟢-Modul mit einem offenen Finding verbunden ist, **muss** der Caveat in externer Kommunikation reproduziert werden.

---

## Hauptmatrix

> Validiert am 2026-05-16 durch Produkt-Lead. Status-Änderungen sind ab hier versioniert über Git.

### Detection & Discovery

| Modul | Status | Reifegrad | Evidence | Belege / Caveats |
|---|---|---|---|---|
| Cookie / Tracker Scan (server-side fetch) | 🟢 | produktiv | append-only `gdpr_audits` | `cookie-scan` Edge Function live |
| Deep Cookie Scan (Playwright) | 🟡 | beta | partial | `cookie-scan-deep` + `services/playwright-scanner` — Deployment ausstehend laut ROADMAP |
| Browser Detection (Extension) | 🟢 | produktiv | client-side telemetry | drei parallele Extensions (`extension/`, `extension-governance/`, `extension-ai-monitor/`) — **Caveat:** Konsolidierung auf eine kanonische Extension empfohlen, bevor Enterprise-Sales |
| Consent Detection / Reject-Equivalence | 🟢 | produktiv | UI + telemetry + e2e | Findings #3 geschlossen — `e2e/cookie-consent.spec.ts` verifiziert UI-Parität (Bounding-Box ±10 %, identischer font-weight, kein Mehr-Klick-Versteck) |
| Vendor / Sub-Processor Inventory | 🟢 | produktiv | inventory page | Findings #6 geschlossen — AI Gateway / LM Studio / EU-lokal-Profile in `SubProcessors.tsx` ergänzt |
| Vendor Drift Detection | 🔴 | roadmap | – | im Blueprint spezifiziert, noch nicht implementiert |
| AI Asset Discovery (Cloud Connectors / CI Hooks) | 🔴 | roadmap | – | Blueprint §2.1 DISCOVER, noch nicht gebaut |

### Classification & Risk

| Modul | Status | Reifegrad | Evidence | Belege / Caveats |
|---|---|---|---|---|
| Rule Engine (DSGVO / AI-Act statisch) | 🟢 | produktiv | versionierte Rules | `_shared/rules/evaluator.ts` + `gdpr.json` + `ai-act.json` |
| AI-Act Classification (regelbasiert) | 🟢 | produktiv | Edge Function logs | **HARTER CAVEAT:** Klassifikation ist regelbasiert und **keine rechtsverbindliche Einstufung**. In jeder externen Kommunikation muss explizit „unterstützt die AI-Act-Klassifikation" stehen, nie „AI-Act-zertifiziert" oder „AI-Act-konform". |
| AI-Act Classification (lernend / kontextuell) | 🔴 | roadmap | – | – |
| Risk Score | 🟢 | produktiv | Edge Function logs | `governance-risk-score` — **Caveat:** Score-Modell intern, nicht extern validiert. Kommunikation als „interner Indikator", nicht als regulatorischer Score. |

### Policy & Enforcement

| Modul | Status | Reifegrad | Evidence | Belege / Caveats |
|---|---|---|---|---|
| Policy-as-Code (OPA/Rego) | 🔴 | roadmap | – | Blueprint §1 Prinzip #8, noch nicht implementiert |
| Runtime Enforcement (allow/warn/block) | 🔴 | roadmap | – | – |
| Approval Queue / Human Review | 🟡 | beta | partial | `governance-approvals` Edge Function vorhanden, Workflow-Reife zu prüfen |

### Evidence & Audit

| Modul | Status | Reifegrad | Evidence | Belege / Caveats |
|---|---|---|---|---|
| Audit Log (append-only) | 🟢 | produktiv | ja | bestehende Tabellenstruktur mit RLS |
| Evidence Vault (hashed records) | 🟢 | produktiv | hash chain | `evidence-vault-export` — **Caveat:** formale Hash-Kette-Spezifikation in Governance Spec v1.0 nachzureichen |
| Evidence Export (Audit-Paket) | 🟢 | produktiv | export pipeline | `evidence-export` + `audit-report-pdf` |
| Immutable Storage / WORM | 🔴 | roadmap | – | – |
| Replay Engine | 🔴 | roadmap | – | – |

### Remediation

| Modul | Status | Reifegrad | Evidence | Belege / Caveats |
|---|---|---|---|---|
| Remediation Hinweise (manuell umsetzbar) | 🟢 | produktiv | im Report | Audit-Report enthält priorisierte Hinweise |
| Auto-Fix Empfehlungen (UI-gestützt) | 🟢 | produktiv | UI flow | Growth-Plan-Feature, **Caveat:** „Empfehlung", nicht „automatische Behebung" — Umsetzung erfolgt durch Nutzer |
| Autonomous Remediation (Agent-driven) | 🔴 | roadmap | – | – |

### Workflows (DPIA, DSR, Incident, Vendor Review)

| Modul | Status | Reifegrad | Evidence | Belege / Caveats |
|---|---|---|---|---|
| DSGVO-Datenexport (Art. 15) | 🟢 | produktiv | audit-log | `gdpr-export` |
| DSGVO-Löschung (Art. 17) | 🟢 | produktiv | audit-log | `gdpr-delete` |
| DPIA Workflow | 🟢 | produktiv | workflow events | `governance-dpias` — **Caveat:** unterstützt DPIA-Erstellung, ersetzt **nicht** die DPO-Verantwortung |
| Incident Workflow | 🔴 | roadmap | – | – |
| Vendor Review Workflow | 🔴 | roadmap | – | – |

### Agent Runtime

| Modul | Status | Reifegrad | Evidence | Belege / Caveats |
|---|---|---|---|---|
| Governance Agent (Ingest + Routing) | 🟢 | produktiv | runtime events | `governance-agent`, `governance-ingest`, `services/openclaw-agent` — **Caveat:** Approval-Gate-Modell muss in ACS v1.0 formal beschrieben werden |
| Agent Contract Specification (ACS) | 🔴 | roadmap | – | Spezifikation steht aus |
| Event Schema Standard (ESS) | 🔴 | roadmap | – | Spezifikation steht aus |
| Runtime Contract Specification (RCS) | 🔴 | roadmap | – | Spezifikation steht aus |

### Plattform / Querschnitt

| Modul | Status | Reifegrad | Evidence | Belege / Caveats |
|---|---|---|---|---|
| Multi-Tenancy (RLS auf `tenant_id`) | 🟢 | produktiv | RLS-Policies | bestehend |
| Auth / RBAC | 🟢 | produktiv | – | Supabase Auth, Owner/Admin/Editor/Viewer |
| EU-Hosting (Supabase eu-central) | 🟢 | produktiv | – | Primärregion EU |
| EU-lokale AI-Inferenz (opt-in) | 🟢 | produktiv | residency routing | Ollama gemma3:4b auf Hostinger DE — **Caveat:** opt-in pro Tenant/User, Cloud-Pfad bleibt Standard |
| Security Headers (HSTS, X-Frame, CSP) | 🟡 | beta | partial | Code geschlossen: `infra/nginx/security-headers.conf` (HSTS, X-Frame, Permissions-Policy, Referrer-Policy) und CSP-CI-Guard `test/compliance/no-raw-tracker-scripts.test.ts`. **Caveat:** Deployment auf Hostinger ausstehend → bis Header live + per `curl -I` verifiziert sind, bleibt 🟡. CSP-Nonce-Umstellung weiterhin als Folge-PR offen. |
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
- "unterstützt die AI-Act-Klassifikation" (für die regelbasierte Klassifikation)

### Verboten — solange keine externe Validierung vorliegt

- "garantiert DSGVO-Compliance"
- "macht Unternehmen AI-Act-konform"
- "ersetzt den/die Datenschutzbeauftragte:n"
- "vollautomatische Rechtsprüfung"
- "AI entscheidet rechtlich"
- "autonome Compliance"
- "AI-Act-zertifiziert"
- "regulatorisch abgesichert"
- "rechtsverbindliche AI-Act-Einstufung"

Diese Liste ist nicht abschließend. Im Zweifel gilt: **unterstützt** statt **garantiert**.

---

## Pflege

- **Owner**: Produkt-Lead.
- **Update-Trigger**: jede Status-Änderung eines Moduls (PR, Release, Audit-Ergebnis, Schließung eines Findings).
- **Review-Kadenz**: vor jedem Investor-Update, vor jedem Enterprise-Pitch, vor jeder externen Veröffentlichung.
- **Konflikt-Regel**: bei Widerspruch zwischen Matrix und anderem Dokument (Website, Deck, README, ROADMAP, Blueprint) **gewinnt die Matrix**. Das andere Dokument ist zu korrigieren.
- **Caveat-Regel**: Jeder Caveat in der Spalte „Belege / Caveats" ist Teil des Modulstatus. Externe Kommunikation, die einen Caveat unterschlägt, ist nicht zulässig.

### Wo diese Matrix gespiegelt wird

- README (Statussäule)
- Pitch Deck (Reifegrad-Slide)
- Enterprise One-Pager
- `docs/architecture/governance-os-blueprint.md` (Vision-Abschnitt verweist auf Matrix für Ist-Stand)
- `ROADMAP.md` (Phasen referenzieren Matrix-Zeilen)

---

## Offene Folgearbeiten aus dieser Validierung

1. **Security-Header-Deployment auf Hostinger** (`infra/nginx/security-headers.conf`) — Snippet in `/etc/nginx/snippets/` einbauen, `nginx -t`, `systemctl reload nginx`, mit `curl -I https://realsyncdynamicsai.de` verifizieren. Solange dieser Schritt fehlt, bleibt Security Headers 🟡.
2. **CSP-Nonce-Umstellung** (Folge-PR zu Befund #2) — Build-time-Plugin oder SSR, damit Tracker-Origins aus `script-src` entfernt werden können.
3. **Browser-Extension-Konsolidierung** auf eine kanonische Variante (`extension/` vs `extension-governance/` vs `extension-ai-monitor/`).
4. **Governance Spec v1.0** anlegen (ESS / ACS / RCS / Evidence-Hash-Chain / Replay / Human Review / Retention / Redaction / Remediation Lifecycle).
5. **README + ROADMAP + Blueprint** auf die Matrix-Bewertungen ausrichten — Status-Aussagen in diesen Dokumenten durch Matrix-Referenz ersetzen.
6. **Sprach-Audit** der öffentlichen Website / Landingpages / Sales-Material gegen die verbotenen Formulierungen.
