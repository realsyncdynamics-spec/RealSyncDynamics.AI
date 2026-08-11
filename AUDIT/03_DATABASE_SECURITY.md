# 03 — Database Security (Supabase / PostgreSQL)

**Methodik:** statische Analyse aller 270 Migrationen (Parser über 341 `CREATE TABLE`
und 620 `CREATE POLICY`) + Live-Probe gegen Produktions-PostgREST mit dem öffentlichen
Publishable-Key. Kein Schreibzugriff auf Produktion (Regel 12/16).

**Nicht verifizierbar von außen:** `pg_class.relrowsecurity`, `pg_policies`, Grants,
Storage-Policies. Dafür ist DB-Zugriff nötig — die Verifikations-Queries stehen unten.

---

## 1. RLS-Abdeckung (Migrations-Evidenz)

| Kennzahl | Wert |
|---|---|
| `CREATE TABLE` gesamt | 341 |
| davon mit `ENABLE ROW LEVEL SECURITY` | 308 (90 %) |
| **ohne RLS und ohne jede Policy** | **35 (10 %)** |
| `CREATE POLICY` gesamt | 620 |
| Policies mit `USING (true)` | 86 |
| davon korrekt `TO service_role` | 71 |
| davon Referenzdaten (`TO authenticated`/`public`, Lesekataloge) | 12 — vertretbar |
| **davon fehlerhaft unbeschränkt** | **3 → F-09** |

### Die 35 Tabellen ohne RLS

Sensibilität absteigend:

| Tabelle | Migration | Datenklasse | Prod |
|---|---|---|---|
| `tax_documents`, `tax_document_links`, `tax_evidence_exports`, `tax_audit_events`, `tax_years`, `tax_reminders` | `20260518000000_tax_evidence_runtime.sql` | **Steuerdaten — hochsensibel** | vorhanden, leer |
| `tax_advisor_reviews`, `tax_advisor_review_comments` | `20260523000000_tax_advisor_reviews.sql` | Beraterkommunikation | vorhanden, leer |
| `provenance_records` | `20260406000000_entitlements_schema.sql` | **Herkunftsnachweise** | vorhanden, leer |
| `orders`, `order_items`, `appointments`, `availability_rules` | `20260628193744_bots_foundation.sql` | Geschäfts-/Kundendaten | vorhanden, leer |
| `bot_agents`, `bot_question_catalog`, `voice_channels` | dito | Bot-Konfiguration | vorhanden, leer |
| `organizations`, `organization_members`, `subscription_addons` | `20260406000000_entitlements_schema.sql` | **Tenant-Struktur** | teils nicht in Prod |
| `inventory_*` (9 Tabellen) | `20260517000000_operations_inventory.sql` | Betriebsdaten | vorhanden, leer |
| `memory_retention_policies` | `20260803000000_rfc003_memory_governance.sql` | Governance-Config | nicht in Prod |
| `seo_marketing_audit_log`, `social_publishing_metrics_hourly` | div. | Telemetrie | vorhanden |
| `_rate_limits`, `_circuit_breakers`, `_operation_metrics` | `20260717192000_add_monitoring_tables.sql` | intern | nicht in Prod |
| `integrations` | `20260706010000_api_and_webhooks.sql` | Integrations-Config | nicht in Prod |

**Live-Befund:** Für die in Produktion vorhandenen Tabellen dieser Gruppe liefert ein
**anonymer** Request HTTP 200 mit `content-range: */0` — die Anfrage wird nicht
abgewiesen, die Tabelle ist aber leer. Kein aktueller Datenabfluss; latent kritisch,
sobald Daten entstehen. Siehe F-08.

---

## 2. Tabellen-Matrix (Kern, verifiziert)

| Tabelle | Zweck | Tenant-Key | RLS | SELECT | INSERT/UPDATE | Service-Role | Risiko |
|---|---|---|---|---|---|---|---|
| `tenants` | Mandanten | `id` | ✅ | Membership | Membership | ja | niedrig |
| `memberships` | User→Tenant | `tenant_id` | ✅ | eigene | service | ja | niedrig |
| `runtime_events` | Prüfpfad | `tenant_id` | ✅ | `tenant_memberships` | **Append-Only-Trigger** | ja | niedrig |
| `governance_assets` | Asset-Registry | `tenant_id` | ✅ | Membership | `_service_all TO service_role` | ja | niedrig |
| `governance_events` | Governance-Events | `tenant_id` | ✅ | Membership | service | ja | niedrig |
| `ai_evidence_events` | Evidenzstrom | `tenant_id` | ✅ | Membership | service | ja | niedrig |
| `dsr_requests` | Betroffenenrechte | `tenant_id` | ✅ | Membership | service | ja | niedrig |
| `governance_ingest_keys` | Ingest-Keys | `tenant_id` | ✅ | service only | service | ja | niedrig |
| `subscriptions` | Abos | `tenant_id` | ✅ | Membership | Webhook | ja | niedrig |
| `document_vault` | Dokumente | — | ✅ | super_admin + service (Fix `20260720124405`) | dito | ja | **behoben** |
| `agent_configuration` | Agent-Config | — | ✅ | **`USING(true)` ohne Rolle** | **alle Rollen `FOR ALL`** | ja | **hoch → F-09** |
| `agent_token_usage` | Token-Verbrauch | — | ✅ | **`USING(true)` ohne Rolle** | service | ja | **mittel → F-09** |
| `website_compliance_reports` | Compliance-Reports | `tenant_id` | ✅ | Membership | **UPDATE `USING(true)` ohne Rolle** | ja | **hoch → F-09** |
| `tax_documents` | Steuerdaten | `tenant_id` (Spalte) | **❌** | **offen** | **offen** | ja | **kritisch latent → F-08** |
| `provenance_records` | Herkunftsnachweise | `tenant_id` (Spalte) | **❌** | **offen** | **offen** | ja | **kritisch latent → F-08** |

---

## 3. Adversariale Tenant-Tests (live, lesend)

Rolle: **unauthenticated / anon** (Publishable-Key aus dem ausgelieferten Bundle).

| Test | Tabelle | Ergebnis |
|---|---|---|
| Anonymes SELECT | `tenants` | `[]` ✅ blockiert |
| Anonymes SELECT | `memberships` | `[]` ✅ |
| Anonymes SELECT | `governance_assets` | `[]` ✅ |
| Anonymes SELECT | `governance_events` | `[]` ✅ |
| Anonymes SELECT | `runtime_events` | `[]` ✅ |
| Anonymes SELECT | `ai_evidence_events` | `[]` ✅ |
| Anonymes SELECT | `dsr_requests` | `[]` ✅ |
| Anonymes SELECT | `findings` / `scan_runs` | `[]` ✅ |
| Anonymes SELECT | `subscriptions` / `products` | `[]` ✅ |
| Anonymes SELECT | `profiles` | `[]` ✅ |
| Anonymes SELECT | `document_vault` | `[]` ✅ |
| Anonymes SELECT | `tax_documents`, `orders`, `provenance_records`, `appointments`, `inventory_items`, `bot_agents`, `voice_channels`, `subscription_addons` | HTTP 200, `*/0` — **nicht abgewiesen**, aber leer ⚠️ |

**Ergebnis:** Auf der Datenbankebene wurde **kein** Cross-Tenant-Leak gefunden.
Die Mandantentrennung bricht nicht in PostgREST, sondern in der Edge-Function-Schicht
(F-04/F-05) — dort umgeht `service_role` die RLS und die Autorisierung fehlt.

**Nicht durchgeführt** (Regel 12/16, kein Schreibzugriff auf Produktion):
Tenant-A→Tenant-B Update/Delete, Service-Role-Eskalation, Storage-Bucket-Tests.
Diese gehören in `test/runtime/db/rls.db.test.ts` gegen eine lokale Instanz —
der Test existiert, läuft aber nicht in CI (F-07).

---

## 4. SECURITY DEFINER

88 Migrationen enthalten `SECURITY DEFINER`, insgesamt ~240 Funktionsdefinitionen.
`20260530210241_pin_remaining_function_search_paths.sql` hat den Großteil nachgezogen.
**16 Migrationen pinnen `search_path` nicht** → F-16.

Positiv: `runtime_events_alloc_seq_and_chain` und `runtime_events_verify_chain` setzen
korrekt `SET search_path = public, extensions`.

---

## 5. Verifikations-Queries (im Projekt auszuführen)

```sql
-- 1. Tabellen ohne RLS  → erwartet: 0 Zeilen
select relname from pg_class
 where relnamespace = 'public'::regnamespace
   and relkind = 'r' and not relrowsecurity
 order by 1;

-- 2. Policies mit USING(true) ohne Rollen-Einschränkung  → F-09
select schemaname, tablename, policyname, roles, cmd, qual
  from pg_policies
 where schemaname = 'public'
   and qual = 'true'
   and not (roles @> '{service_role}')
 order by tablename;

-- 3. SECURITY DEFINER ohne gepinnten search_path  → F-16
select p.proname, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and (p.proconfig is null or not (p.proconfig::text like '%search_path%'));

-- 4. Anon-/authenticated-Grants auf sensiblen Tabellen
select table_name, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated')
   and table_name like 'tax_%';

-- 5. Hash-Chain-Integrität pro Tenant
select * from public.runtime_events_verify_chain('<tenant-uuid>')
 where not valid or not chain_ok;
```
