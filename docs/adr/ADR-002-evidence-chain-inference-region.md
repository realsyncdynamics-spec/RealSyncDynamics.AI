# ADR-002: Evidence-Chain & Inference-Region

- **Status:** Draft
- **Date:** 2026-05-18
- **Author:** Dominik Steiner
- **Scope:** Evidence-Vault Härtung + AI-Inferenz-Datenresidenz
- **Related:** [`ADR-001-event-backbone.md`](./ADR-001-event-backbone.md) · `supabase/functions/ai-risk/classifier.ts` Kopfkommentar

---

## 1. Context

Zwei separate, aber zeitlich gekoppelte Migrationen, die beide regulatorisch
durch Enterprise-Verträge oder Audit-Behörden ausgelöst werden:

**(a) Evidence-Chain-Härtung.** Heute SHA-256-Hash-Kette mit Per-Tenant-
Advisory-Lock (siehe `supabase/migrations/20260510_ai_governance_core.sql`,
`tg_evidence_event_chain`-Trigger). Manipulationssicherheit gegen lokale
Postgres-Compromise gegeben. **Nicht** gegen: forgery durch Service-Role-Key-
Compromise (Angreifer mit Service-Role kann Chain rückwirkend neu signieren)
und externe Auditierbarkeit (kein RFC-3161-Anchor in vertrauenswürdiger
Drittstelle).

**(b) Inferenz-Datenresidenz.** Heute Anthropic Messages API in
us-east-1 (`https://api.anthropic.com/v1/messages`). Tool-Use-Schema-Erzwingung
und Bearer-Auth gegen `AI_RISK_AGENT_TOKEN` im Edge-Function-Layer. Customer-
Payload verlässt die EU-Datenzone für den Inferenz-Call. Für KMU-Kunden im
B2B-Kontext heute akzeptabel; für Enterprise-Verträge mit harten EU-Only-
Klauseln (Banking, Insurance, Public Sector) ein Blocker.

## 2. Decision

Entscheidung wird in zwei Sub-Decisions aufgeteilt, kann unabhängig
ausgelöst werden:

### 2.1 Evidence-Chain

- **Ed25519-Signatur** pro Chain-Eintrag, Private-Key im Supabase Vault
  (`evidence_signing_key`), Public-Key in `public.evidence_chain_keys`
  als Verification-Endpoint für Auditoren.
- **RFC-3161-Timestamping** alle 24h gegen externe TSA (z. B. DFN-PKI oder
  GlobalSign). Stamp wird als separater Eintrag in der Chain verankert,
  sodass jeder Customer-Event indirekt eine externe Zeit-Quittung erbt.
- Neue Spalten auf `ai_evidence_events`: `signature_ed25519 bytea`,
  `rfc3161_anchor_id uuid REFERENCES public.evidence_rfc3161_anchors(id)`.

### 2.2 Inferenz-Region

- **Default-Pfad bleibt Anthropic-Direct** (us-east-1) — Burn-Rate-Argument
  aus ADR-001.
- **Enterprise-Opt-In auf AWS Bedrock eu-central-1 oder eu-west-1.** Per
  Tenant in `tenants.ai_inference_region`-Spalte konfigurierbar
  (`anthropic_us | bedrock_eu_central | bedrock_eu_west | local_ollama`).
- Implementations-Pfad: `supabase/functions/ai-risk/classifier.ts` wird
  in `classifier-anthropic.ts` und `classifier-bedrock.ts` aufgeteilt
  hinter einer gemeinsamen `Classifier`-Schnittstelle. Selector liest
  `tenant.ai_inference_region`.
- Bedrock-Spezifika (aus `classifier.ts`-Kopfkommentar): AWS SigV4-Signing
  oder Bearer via `aws-bedrock-token-generator`, InvokeModel- oder
  Converse-API, `anthropic_version: "bedrock-2023-05-31"` im Body,
  IAM-Model-Access pro Region.

## 3. Triggers (wann diese ADR aktiviert wird)

Aktivierung pro Sub-Decision separat. Sub-Decision wird Accepted, sobald
**einer** der Trigger feuert.

### 3.1 Evidence-Chain-Aktivierung

| Trigger | Quelle |
|---|---|
| Enterprise-Vertrag fordert prüffähigen Audit-Trail mit externem Zeitstempel | Vertragsverhandlung |
| Audit-Behörde (BfDI, BaFin, NIS2-NIS-Inspektor) fordert RFC-3161-Anker | Eingehende Anfrage |
| Interner Compromise-Test legt Service-Role-Key-Manipulation des Chain-Trails offen | Pentest-Befund |
| ISO 27001-Zertifizierungs-Vorbereitung | Roadmap-Decision |

### 3.2 Inferenz-Region-Aktivierung

| Trigger | Quelle |
|---|---|
| Erster Enterprise-Vertrag mit EU-Only-Inferenz-Klausel | Vertragsverhandlung |
| Customer DPA-Review fordert AWS-DPA statt Anthropic-DPA | Sales-Diligence |
| Anthropic-API-Outage-Häufigkeit > 2 pro Quartal | Monitoring (siehe `monitoring.daily_metrics`) |
| Anthropic-Preis-Erhöhung > 30% bei gleichbleibendem Bedrock-Preis | Cost-Monitoring |

## 4. Consequences

### Positiv (bei Aktivierung)
- Customer-DPA wird simpler (nur AWS, kein zusätzlicher Anthropic-DPA).
- Evidence-Chain wird forensisch belastbar gegen Insider-Compromise.
- Beide Sub-Decisions sind separat verkaufbar — „EU-Inferenz + RFC-3161-Anker"
  wird zum Enterprise-Tier-Differenziator.

### Negativ
- **Evidence-Chain:** Key-Management-Overhead (Rotation, Backup, Disclosure
  des Public-Keys). RFC-3161-TSA-Vertrag mit DFN oder GlobalSign nötig.
- **Inferenz-Region:** Bedrock pro 1k-Token tendenziell teurer als
  Anthropic-Direct. AWS-Account + IAM-Setup + Region-Replication.
  Classifier-Code wird komplexer (zwei Implementierungen statt einer).
- Eval-Schwellen müssen pro Inferenz-Region separat gemessen werden
  (Bedrock Haiku 4.5 könnte minimal anders kalibriert sein als
  Anthropic-Direct Haiku 4.5).

## 5. Out of Scope

- On-Prem-Inferenz via Ollama (separate Decision, gehört zu „Sovereign
  Tier" — eigener ADR).
- Hashing-Algorithmus-Wechsel SHA-256 → SHA-3 (kein konkreter Trigger
  in Sicht; SHA-256 ist im EU-AI-Act-Kontext akzeptiert).
- Hardware-Security-Module (HSM) für Signaturen — erst bei
  Bank-Lizenz-Anforderungen relevant.

## 6. Review-Kadenz

Dieser ADR wird **quartalsweise** gegen die Trigger-Liste reviewed.
Bei Trigger-Hit wird die jeweilige Sub-Decision zu Accepted und eine
Folge-Migration plus Operations-Runbook geschrieben.

Letztes Review: 2026-05-18 (Initial Draft)
Nächstes Review: 2026-08-18
