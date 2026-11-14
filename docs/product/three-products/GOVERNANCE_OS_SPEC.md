# Produktspezifikation — RealSync Governance OS (GOVERN)

Stand 07.11.2026 · Status-Quelle `src/product/productSuite.ts` · Öffentliche Seite `/produkte/governance-os`

## Zielgruppe

Eigenständig: KMU und regulierte Unternehmen mit KI-Einsatz, Datenschutzbeauftragte, Agenturen. Eingebettet:
alle Kunden von Build Studio und Agent Studio (gemeinsame Kontrollschicht).

## Nutzenversprechen

KI- und Datenschutzrisiken erkennen, bewerten und kontrollieren — mit laufenden Prüfungen und dokumentierten
Nachweisen. Scans sind technische Hilfsmittel, keine Rechtszertifizierung; die rechtliche Bewertung bleibt beim
Kunden bzw. qualifizierten Fachpersonen.

## Module und Status

| Modul | Funktionen | Status | Route / Beleg |
|---|---|---|---|
| Discover & Scan | Website-/Tracking-Analyse, KI-Inventar, Datenflüsse | LIVE | `/audit`, `/app/ai-systems` |
| Risk & Compliance | DSGVO-Prüfprozesse, EU-AI-Act-Klassifizierung, Risikoregister, Maßnahmen | LIVE (Inventar-Persistenz PREVIEW) | `/ai-act-klassifikator`, `/app/risks`, `/app/remediation` |
| Policy Engine | Richtlinien, Evaluation, serverseitiges Enforcement | LIVE | `/policy-engine`, `/app/policy-packs`, `supabase/functions/policy-packs` |
| Freigaben | Approval Gates, Entscheidungen | PREVIEW | `/app/governance/gates`, `supabase/functions/governance-approvals` |
| Evidence Vault | Ereignisprotokolle, Hash-Kette, Integritätsprüfung, Export | LIVE | `/app/evidence`, `/app/governance/evidence`, `supabase/functions/evidence-*` |
| Monitoring & Operations | Einzelprüfungen, Berichte LIVE; Dauerüberwachung, Drift NOT IMPLEMENTED | gemischt | `/app/monitoring`, `/app/reports` |
| Command Center | Übersicht, Mandant, Rollen, Freigaben, Evidence, Integrationen | LIVE | `/app/dashboard` |
| Agent Governance | Governance für Agenten-Ereignisse | PREVIEW | `/agent-governance` |

Die vorhandene Governance Runtime wird **nicht** neu implementiert; keine parallele Policy Engine.

## Rolle als gemeinsame Schicht

| Ereignis aus | Governance-Anbindung heute |
|---|---|
| Build Studio | Publish Gate bewertet jede gespeicherte Version (PREVIEW) |
| Agent Studio | AI Gateway protokolliert jeden Call; Budget-Reservierung `bot-chat`; Signaturprüfung WhatsApp (PREVIEW) |
| Gemeinsam | Evidence und Command Center im selben Mandanten (LIVE) |

## Datenflüsse und APIs

Scans (`gdpr-audit`, `cookie-scan`, `audit-*`) → Findings → Risiko/Policy (`governance-*`, `policy-packs`) →
Freigaben (`governance-approvals`, `governance-decide`) → Evidence (`evidence-*`, Hash-Kette) → Export/Berichte.
Fail-closed bei Auth-, Policy- oder Kill-Switch-Fehlern.

## Kommerzielles Modell

Bestehende Pläne Free Audit · Starter · Growth · Agency · Enterprise aus `shared/pricing.ts`, Beta laut
`src/config/beta.ts`. Keine Änderung.

## Abnahmekriterien

- [ ] Jede produktübergreifende Aktion serverseitig auf Identität, Mandant, Rolle, Policy und Freigabe geprüft.
- [ ] Evidence-Kette verifizierbar (Integritätsprüfung grün), Export reproduzierbar.
- [ ] Keine Aussage „zertifiziert“ oder „rechtssicher“ auf Basis eines Scans.
- [ ] Dauerüberwachung erst LIVE, wenn Scheduler produktiv und gemessen.
