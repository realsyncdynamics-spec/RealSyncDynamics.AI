# Security Signal Integration Layer

Überführt externe technische Findings (blacklens.io, Cloudflare, GitHub, SIEM …)
in Governance-Objekte des RealSyncDynamics Governance OS:

```
Finding → Risk → Control Mapping → Task → Evidence
```

Der Layer ist additiv und non-breaking: drei neue Tabellen, eine Edge Function,
eine App-Route. Bestehende Governance-Tabellen werden best-effort wiederverwendet.

---

## Architektur

```
 Provider Payload (blacklens / cloudflare / github / siem / generic)
        │  POST  /functions/v1/security-signal-ingest
        │  Header: x-rsd-api-key: <key>
        ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ security-signal-ingest (Edge Function, verify_jwt = false)    │
 │                                                                │
 │  1. sha256(x-rsd-api-key) → security_signal_sources lookup     │
 │  2. normalizeSecuritySignal(provider, payload)                 │
 │  3. upsert security_signals  (tenant_id, provider, external_id)│
 │  4. mapSignalToGovernance(signal)                              │
 │  5. insert governance_risk_links  (Control-Mapping)            │
 │  6. best-effort: governance_event → governance_evidence        │
 │     → governance_approval (Risk Review, nur high/critical)     │
 └──────────────────────────────────────────────────────────────┘
        ▼
 UI  /app/security-signals  — Liste · Filter · Detail · Mapping · CTAs
```

### Komponenten

| Datei | Zweck |
| --- | --- |
| `supabase/migrations/20260626100000_security_signal_integration.sql` | Tabellen + RLS |
| `src/lib/securitySignals/normalizeSecuritySignal.ts` | Provider-Normalizer (kanonisch) |
| `src/lib/securitySignals/mapSignalToGovernance.ts` | Risk-Mapping-Engine (kanonisch) |
| `supabase/functions/_shared/securitySignals.ts` | Deno-Port von Normalizer + Mapping |
| `supabase/functions/security-signal-ingest/index.ts` | Ingest-API |
| `src/features/governance/security-signals/securitySignalsApi.ts` | FE-Datenzugriff |
| `src/features/governance/security-signals/SecuritySignalsView.tsx` | App-Screen |

> **Hinweis zur Doppelung:** `normalizeSecuritySignal` und `mapSignalToGovernance`
> existieren zweimal — einmal in `src/lib` (Vite/TS, Frontend + Tests) und als
> Deno-Port in `supabase/functions/_shared/securitySignals.ts` (Edge Runtime),
> analog zu `policyEngine.ts`. Bei Logikänderungen **beide** Stellen anpassen.

---

## Datenmodell

### `security_signal_sources`
Registrierte Quellen. Gespeichert wird nur der sha256-Hash des API-Keys.

| Spalte | Typ | Hinweis |
| --- | --- | --- |
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants |
| `name` | text | |
| `provider` | text | blacklens \| cloudflare \| github \| siem \| generic |
| `status` | text | active \| paused \| revoked |
| `config` | jsonb | provider-spezifische Konfiguration |
| `api_key_hash` | text UNIQUE | sha256(API-Key) |
| `api_key_prefix` | text | Anzeige-Präfix |
| `last_used_at` | timestamptz | |
| `created_at` / `updated_at` | timestamptz | |

### `security_signals`
Normalisierte Findings. Upsert-Schlüssel: `(tenant_id, provider, external_id)`.

| Spalte | Typ | Hinweis |
| --- | --- | --- |
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants |
| `source_id` | uuid | FK → security_signal_sources |
| `provider`, `external_id` | text | Upsert-Schlüssel |
| `event_type`, `severity`, `title`, `description`, `asset_ref` | text | normalisiert |
| `raw_payload` | jsonb | Original-Payload |
| `normalized_payload` | jsonb | inkl. `governance` (Mapping-Ergebnis) |
| `status` | text | open \| acknowledged \| in_review \| accepted \| resolved \| false_positive |
| `first_seen_at`, `last_seen_at` | timestamptz | |

### `governance_risk_links`
Verknüpft ein Signal mit Risk-/Framework-/Control-Referenz.

| Spalte | Typ | Hinweis |
| --- | --- | --- |
| `id` | uuid PK | |
| `tenant_id` | uuid | FK → tenants |
| `signal_id` | uuid | FK → security_signals |
| `risk_id` | uuid | optional |
| `framework`, `control_ref`, `mapping_reason` | text | UNIQUE(signal_id, framework, control_ref) |

---

## API Contract

### Request
```
POST /functions/v1/security-signal-ingest[?provider=<override>]
Content-Type: application/json
x-rsd-api-key: <key>

<beliebiger Provider-Payload>
```

- Provider-Reihenfolge: `?provider=` → Source-`provider` → Payload-Feld `provider` → Heuristik.
- Body-Limit: 1 MB (DoS-Schutz vor dem JSON-Parsing).

### Response (200)
```json
{
  "ok": true,
  "signal_id": "uuid",
  "risk_level": "critical",
  "mapped_controls": ["GDPR:Art. 32", "NIS2:Security Measures", "ISO_27001:A.8"],
  "created_or_updated": "created",
  "governance": { "event_id": "uuid|null", "evidence_id": "uuid|null", "task_id": "uuid|null" }
}
```

### Fehler
Einheitliches Format `{ ok: false, error: { code, message } }`:

| Status | Code | Bedeutung |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Header fehlt / Key unbekannt |
| 403 | `SOURCE_INACTIVE` | Quelle pausiert/revoked |
| 400 | `BAD_REQUEST` | ungültiges JSON |
| 413 | `BODY_TOO_LARGE` | > 1 MB |
| 422 | `INCOMPLETE_SIGNAL` | external_id/title nicht ableitbar |
| 405 | `METHOD_NOT_ALLOWED` | nicht POST |

---

## Beispiel-Payloads

### blacklens.io
```json
{
  "provider": "blacklens",
  "finding_id": "bl-demo-001",
  "severity": "critical",
  "title": "Publicly exposed admin interface",
  "description": "Admin panel exposed on public internet without additional access restrictions.",
  "asset": "https://realsyncdynamicsai.de/admin",
  "first_seen": "2026-06-26T08:00:00Z",
  "last_seen": "2026-06-26T08:05:00Z",
  "tags": ["attack-surface", "web", "gdpr-art-32"]
}
```
Flexible Feld-Aliase: `finding_id|id|external_id`, `severity|risk|priority`,
`asset|domain|host|ip`, `title|name`, `description|details`,
`created_at|first_seen`, `updated_at|last_seen`.

### Cloudflare (WAF / Firewall Event)
```json
{
  "ray_id": "7d3f0000abcd1234",
  "action": "block",
  "clientRequestHTTPHost": "app.example.com",
  "ruleMessage": "SQL injection attempt blocked",
  "datetime": "2026-06-26T09:00:00Z"
}
```
`action: block` → severity `critical`. Host wird zu `asset_ref`.

### GitHub (Code/Secret Scanning Alert Webhook)
```json
{
  "action": "created",
  "alert": {
    "number": 42,
    "rule": { "security_severity_level": "high", "description": "Hardcoded secret detected" },
    "created_at": "2026-06-26T07:00:00Z"
  },
  "repository": { "full_name": "realsync/app" }
}
```
`alert.number` → `external_id`, `repository.full_name` → `asset_ref`.

---

## Risk-Mapping-Regeln

| Bedingung | Frameworks / Controls | Task | Evidence |
| --- | --- | --- | --- |
| severity critical/high | GDPR Art. 32, NIS2 Security Measures, ISO 27001 A.8 | `risk_review` (high) | Signal Snapshot |
| asset = Domain/Web/API | ISO 27001 A.8.16, NIS2 Attack Surface Management | `attack_surface_review` | — |
| Payload enthält PII (`personal_data`, `customer_data`, `email`, `iban` …) | GDPR Art. 33/34 | `dpo_review` (high) | PII Assessment |
| sonst (Fallback) | ISO 27001 A.5.7 (Threat Intelligence) | `triage` (low) | — |

`riskLevel` = 1:1-Abbildung der Severity (`critical|high|medium|low|info`),
kompatibel zum `risk_level`-Vokabular von `governance_events`.

---

## Security-Modell

- **Auth:** API-Key im Header `x-rsd-api-key`; nur der sha256-Hash wird gespeichert.
  Der Klartext-Key verlässt das System genau einmal (bei Erstellung der Source).
- **Tenant-Bindung:** `tenant_id` stammt **immer** aus der Source-Zeile, nie aus
  dem Payload → kein Cross-Tenant-Spoofing über manipulierte Payloads.
- **Keine Secrets im Log:** Keys/Hashes werden nicht geloggt; Fehler sind generisch.
- **DoS-Schutz:** 1-MB-Body-Limit vor dem Parsen.
- **Best-effort-Governance-Chain:** Event/Evidence/Approval-Erzeugung ist gekapselt;
  Fehler dort beeinflussen den Ingest nicht.

### RLS-Hinweise

- Alle drei Tabellen haben RLS aktiviert.
- **Lesen/Status pflegen:** Tenant-Mitglieder via `public.is_tenant_member(tenant_id)`.
- **Ingest/Schreiben:** ausschließlich `service_role` (Edge Function mit Service-Role-Key).
- `security_signals`: Tenant-Mitglieder dürfen `UPDATE` (Status-CTAs), aber kein `INSERT`/`DELETE`.
- `governance_risk_links`: für Tenant-Mitglieder read-only; Schreiben nur `service_role`.

---

## Deployment-Hinweise

1. **Migration** anwenden:
   ```bash
   supabase db push          # oder über die CI-Migrationspipeline
   ```
2. **Edge Function** deployen (kein JWT, da API-Key-Auth — bereits in `config.toml`):
   ```bash
   supabase functions deploy security-signal-ingest --no-verify-jwt
   ```
3. **Source + API-Key** anlegen (Beispiel-SQL):
   ```sql
   insert into public.security_signal_sources (tenant_id, name, provider, api_key_hash, api_key_prefix)
   values (
     '<TENANT_UUID>', 'blacklens prod', 'blacklens',
     encode(digest('<KLARTEXT_KEY>', 'sha256'), 'hex'),  -- pgcrypto
     left('<KLARTEXT_KEY>', 8)
   );
   ```
   Der Hash kann auch mit `printf '%s' '<KEY>' | sha256sum` erzeugt werden
   (siehe `scripts/test-security-signal-ingest.sh`).

### Benötigte Env Vars (Edge Function)
| Variable | Zweck |
| --- | --- |
| `SUPABASE_URL` | von Supabase bereitgestellt |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role für Ingest |

(Frontend nutzt `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` wie üblich.)

---

## Lokaler Test

```bash
# Unit-Tests
npm test -- test/lib/securitySignals

# Ingest-Smoke-Test (gibt auch den api_key_hash aus)
SUPABASE_URL=http://127.0.0.1:54321 \
RSD_SIGNAL_KEY=dev-secret-key \
bash scripts/test-security-signal-ingest.sh
```

UI: `npm run dev` → `http://localhost:3000/app/security-signals`.

---

## Nächste Ausbaustufen

1. **Key-Management-UI** (`/app/security-signals` → „Quelle hinzufügen", Key einmalig anzeigen) analog `governance-keys`.
2. **Pull-/Polling-Connectors** für blacklens/Cloudflare/GitHub-APIs (Cron) statt nur Push-Ingest.
3. **Dedup & Korrelation** über Provider hinweg (gleiches Asset/CVE aus mehreren Quellen zusammenführen).
4. **Auto-Remediation** über `integration_connectors`/`remediation_actions` (Jira/GitHub-Issue aus Signal).
5. **Eigenständige Tasks-Tabelle** + Verknüpfung `governance_risk_links.risk_id` → `ai_act_risk_inventory` für vollständige Risk-Lifecycle-Nachverfolgung.
