# Security Signal Integration — Repository-Analyse (Phase 1)

Stand: 2026-06-26 · Branch: `claude/security-signal-integration-72e3f9`

Diese Analyse ist die Grundlage für den **Security Signal Integration Layer**, der
externe technische Findings (blacklens.io, Cloudflare, GitHub, SIEM …) in
Governance-Objekte überführt:

```
Finding → Risk → Control Mapping → Task → Evidence
```

---

## 1. Ist-Zustand (Tech-Stack)

| Bereich | Technologie |
| --- | --- |
| Frontend | Vite 6 + React 19 + TypeScript (strict-ish, `tsc --noEmit`) |
| Routing | `react-router-dom` 7, zentral in `src/App.tsx` |
| State | React Context (`TenantProvider`), kein Redux |
| Auth | Supabase Auth (JWT), Tenant-Kontext via `useTenant()` → `activeTenantId` |
| Backend | Supabase: Postgres + RLS, Edge Functions (Deno), Storage |
| Edge Functions | ~90 Functions unter `supabase/functions/`, gemeinsame Helfer in `_shared/` |
| Tests | Vitest (`test/**/*.test.ts`), Playwright (E2E) |
| Design-System | App/Dashboard = Hard-Edge Industrial (Obsidian/Titanium, keine runden Ecken) |

### Bestehende Governance-/Risk-/Evidence-Module

Das Repository besitzt bereits ein vollständiges **Governance OS**:

- **Tenancy:** `tenants`, `memberships`, RLS-Helfer `public.is_tenant_member(tenant_id)`
- **Assets:** `governance_assets` (Asset-Registry inkl. AI-Act-Klassen, Annex III)
- **Policies/Events:** `governance_policies`, `governance_events`, `governance_evidence`
- **Approvals:** `governance_approvals` (Freigabe-/Review-Tasks)
- **Findings/Scans:** `findings`, `scan_runs` (Detector-agnostische Compliance-Findings)
- **Risiken:** `ai_act_risk_inventory`, UI `RiskCenterView`
- **Incidents:** `incidents` (inkl. 72h-Meldefrist)
- **Frameworks:** `framework_controls` (GDPR, EU_AI_ACT, ISO_27001, SOC_2, NIS2, DORA, …),
  `asset_control_mappings`
- **Ingest-Pattern:** `governance_ingest_keys` + Edge Function `governance-ingest`
  (API-Key = sha256(`rsd_gov_…`), Bearer-Header, Policy-Engine, Webhooks)

---

## 2. Bestehende Architektur — relevante Dateien

| Frage | Antwort / Ort |
| --- | --- |
| Tenant-Modell | `tenants`, `memberships`; Spalte überall `tenant_id`. Helfer `is_tenant_member()` |
| Risiken | `ai_act_risk_inventory` (`supabase/migrations/20260612100000_…`), UI `src/features/governance/risks/RiskCenterView.tsx` |
| Evidence | `governance_evidence` (`…20260512000000_governance_events.sql`), UI `EvidenceVaultView.tsx` |
| Scans/Findings | `findings`, `scan_runs` (`…20260610200000_…`, `…20260611000000_…`) |
| Compliance-Mappings | `framework_controls` + `asset_control_mappings` |
| Tasks | Kein generisches Task-Modell; `governance_approvals` dient als Review-/Freigabe-Task |
| API/Edge Functions | `supabase/functions/*`, gemeinsame Helfer `supabase/functions/_shared/*` |
| Ingest-Auth | `governance-ingest` + `governance-keys` (sha256-gehashte Keys, Bearer-Header) |
| App-Screens | `src/features/governance/*`, Routen in `src/App.tsx`, Navigation in `src/components/governance-os/governanceModules.ts` |
| Supabase-Client (FE) | `src/lib/supabase.ts` → `getSupabase()` |

### Wiederverwendbare Edge-Patterns (`_shared/`)

- `gateway.ts` — `corsHeaders`, `handleOptions`, `jsonResponse`, `jsonError`
- `hash.ts` — `sha256Hex`, `randomToken`
- `policyEngine.ts` — `evaluatePolicies(...)`
- Service-Role-Client: `createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })`

### RLS-Standardmuster

```sql
ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<t> tenant-select" ON public.<t> FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "<t> tenant-insert" ON public.<t> FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
-- + service_role FOR ALL USING (true) WITH CHECK (true)  -- Ingest aus Edge Functions
```

---

## 3. Lückenanalyse

| Baustein | Vorhanden? | Lücke |
| --- | --- | --- |
| Externe Signal-Quellen (Sources) | ❌ | Keine Tabelle für blacklens/Cloudflare/GitHub/SIEM-Quellen + deren API-Keys |
| Normalisierte Security-Signale | ⚠️ teilweise | `findings` ist Website/Scan-zentriert; kein generisches „external security signal" |
| Finding→Risk→Control-Verknüpfung | ⚠️ teilweise | `asset_control_mappings` koppelt an Assets, nicht an externe Signale |
| Provider-Normalizer | ❌ | Kein flexibler Multi-Provider-Normalizer |
| Risk-Mapping-Engine | ❌ | Keine Regel-Engine Signal→Frameworks/Controls/Tasks/Evidence |
| Ingest-Endpoint für Signale | ❌ | `governance-ingest` erwartet vordefiniertes Event-Schema, kein Provider-Payload |
| UI „Security Signals" | ❌ | Keine Liste/Detail für externe Signale |

---

## 4. Empfohlene Zielarchitektur (MVP)

Drei neue, additive Tabellen + ein dünner Ingest-Layer, der bestehende
Governance-Objekte **wiederverwendet** statt zu duplizieren:

```
 Provider Payload (blacklens / cloudflare / github / generic)
        │  POST  x-rsd-api-key
        ▼
 supabase/functions/security-signal-ingest
        │ 1. Key → security_signal_sources (sha256)
        │ 2. normalizeSecuritySignal(provider, payload)
        │ 3. upsert security_signals  (tenant_id, provider, external_id)
        │ 4. mapSignalToGovernance(signal) → frameworks/controls/tasks/evidence
        │ 5. insert governance_risk_links  (Control-Mapping)
        │ 6. best-effort: governance_event + governance_evidence + governance_approval
        ▼
 UI  /app/security-signals  (Liste · Filter · Detail · Governance-Mapping · CTAs)
```

### Neue Tabellen

- `security_signal_sources` — registrierte Quellen + gehashter API-Key
- `security_signals` — normalisierte Findings (upsert nach `tenant_id+provider+external_id`)
- `governance_risk_links` — Signal ↔ Risk ↔ Framework/Control-Mapping

### Wiederverwendung statt Duplikat

- **Evidence:** `governance_evidence` (best-effort Snapshot, hängt an `governance_event`)
- **Task/Review:** `governance_approvals` (best-effort „Risk Review" für high/critical)
- **Frameworks:** Strings kompatibel zu `framework_controls` (GDPR, EU_AI_ACT, NIS2, ISO_27001)

---

## 5. MVP-Scope

**Drin:**
- 3 Tabellen + RLS (tenant-scoped, service_role ingest)
- Normalizer (blacklens, cloudflare, github, generic)
- Mapping-Engine (Severity-, Asset- und PII-Regeln)
- Edge Function `security-signal-ingest` (API-Key-Auth, Upsert, Mapping, best-effort Governance-Chain)
- UI `/app/security-signals` (Liste, Filter, Detail-Drawer, Raw-JSON, Mapping, CTAs)
- Navigation, Demo-Payload, curl-Test, Unit-Tests, Doku

**Draußen (nächste Stufen):**
- Pull-/Polling-Connectors (nur Push-Ingest im MVP)
- Eigenständige Tasks-Tabelle, Auto-Remediation
- Dedup/Korrelation über mehrere Provider hinweg
- Key-Management-UI (Keys werden vorerst per SQL/Seed angelegt)

---

## 6. Risiken

| Risiko | Mitigation |
| --- | --- |
| RLS-Bruch / Cross-Tenant-Leak | Tenant-scoped Policies + `tenant_id` immer aus Source-Row, nie aus Payload |
| Secrets-Leak | Nur sha256-Hash des Keys gespeichert; keine Secrets/Keys geloggt |
| Schema-Drift (zwei Runtimes) | Normalizer/Mapping als reine Funktionen, Deno-Port in `_shared/` spiegelt `src/lib` |
| Breaking Changes | Nur additive Migration; keine Änderung an bestehenden Tabellen/Routen |
| Payload-DoS | 1 MB Body-Limit vor JSON-Parse (wie `governance-ingest`) |

---

## 7. Migrationsplan

1. Additive Migration `20260626100000_security_signal_integration.sql` (3 Tabellen, RLS, Indizes, Trigger).
2. Keine Änderung an bestehenden Tabellen → RLS bleibt intakt.
3. Edge Function `security-signal-ingest` mit `verify_jwt = false` (API-Key-Auth) deployen.
4. Frontend-Route additiv ergänzen.
5. Source + API-Key per Seed/SQL anlegen (Key-Hash = sha256 des Klartext-Keys).
6. Rollback: Migration ist isoliert (DROP der 3 Tabellen genügt, keine FKs aus Bestand).
