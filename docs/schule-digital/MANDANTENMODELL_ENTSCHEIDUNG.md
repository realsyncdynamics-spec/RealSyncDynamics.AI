# Mandantenmodell – `tenants` vs. `organizations`

**Status:** KONZEPT, offene Entscheidung für Dominik  
**Stand:** 27.11.2026, 23:55 (Europe/Berlin), `main` @ `a53dce7c`

Schule DIGITAL braucht eine verbindliche Mandantengrenze (Schule, ggf. Schulträger darüber). Im Repo existieren bereits zwei Modelle. Ein drittes Modell würde gegen „Integration First“ und gegen „keine parallele Plattform“ verstoßen. Diese Datei stellt die Belege, Optionen und eine Empfehlung als Vorschlag dar. Die Entscheidung liegt bei Dominik.

## 1. Bestand (Fakten)

### 1.1 `tenants` und `tenant_memberships`

`tenant_memberships` ist in einer Migration definiert:

- Datei: `supabase/migrations/20260602100000_runtime_events_backbone.sql:75-80`
- Spalten laut Migration: `tenant_id` (FK auf `public.tenants(id)`), `user_id` (FK auf `auth.users(id)`), `role` mit Check `owner` / `admin` / `member` / `viewer`
- Zweck im Kommentar der Datei: „RLS substrate“, Backfill aus einer älteren Tabelle `memberships` (Zeilen 26, 29, 73 ff.)

Die Tabelle `tenants` selbst ist in keiner Datei unter `supabase/migrations/` per `CREATE TABLE` definiert. Sie erscheint in Test-Bootstraps, unter anderem `scripts/test-db/bootstrap.sql:70` (`CREATE TABLE IF NOT EXISTS public.tenants`). Ob und mit welchem Schema `tenants` in der Produktionsdatenbank existiert, ist **NICHT VERIFIZIERT**.

RLS ist um dieses Modell herum gebaut:

- `is_tenant_member` – `supabase/migrations/20260723000001_rls_recursion_fix_security_definer.sql:21` (zuvor `supabase/migrations/20260430180000_tenant_rls_and_webhook_events.sql:26`)
- `is_tenant_admin` – `supabase/migrations/20260621000000_p0a_mfa_security.sql:21`

Weitere tenant-bezogene Tabellen (Auswahl): `tenant_invites` (`20260430300000_tenant_invites.sql:8`), `tenant_onboarding` (`20260928132000_tenant_onboarding.sql:40`), `tenant_provisioning_runs` (`20260928150000_tenant_boot_provisioning.sql:19`), `tenant_security_settings` (`20260621000000_p0a_mfa_security.sql:40`), `tenant_cost_caps` / `tenant_cost_ledger`.

### 1.2 `organizations` und `organization_members`

Definiert in `supabase/migrations/20260406000000_entitlements_schema.sql:8-25`:

- `organizations`: `id`, `name`, `is_public_sector`, Zeitstempel
- `organization_members`: `organization_id`, `user_id`, `role` mit Check `owner` / `admin` / `editor` / `viewer_auditor`
- `subscriptions` in derselben Datei (`:27`) hängt an `organization_id` und `stripe_customer_id`

`entitlements` liegt in `supabase/migrations/20260430200000_entitlements_normalization.sql:30`.

NOVA merkte an, eine statische Analyse habe `organizations` und `organization_members` ohne RLS gemeldet; der Repo-Regressionstest führt sie nicht in der Schuldenliste. NOVA stufte das als NICHT VERIFIZIERT ein und empfahl die Live-Prüfung (Bericht H1, Hinweis). In den Migrationen wurde bei der Analyse kein `ENABLE ROW LEVEL SECURITY` auf diese beiden Tabellen gefunden (Suche 27.11.2026).

### 1.3 Hierarchie-Ansatz `org_units`

`org_units.parent_id` (`supabase/migrations/20260824120000_org_subject_model_approval_gates.sql:29`) erlaubt eine Baumstruktur. Ein Schulbezug (Schulträger → Schule → Klasse) ist im Schema **nicht** belegt. Dass sich `org_units` dafür eignet, ist eine **ANNAHME**.

### 1.4 Live-Zustand

RLS-Status, Grants und die tatsächliche Existenz von `tenants` in Produktion sind ohne Supabase-Konto **NICHT VERIFIZIERT**. Die Messung steht in [RLS_MESSUNG.sql](./RLS_MESSUNG.sql).

## 2. Optionen

| Option | Beschreibung | Folge |
|---|---|---|
| A | `tenants` wird die kanonische Isolationsgrenze (eine Schule = ein Tenant). | Passt zu den bestehenden RLS-Helpern. Die Herkunftstabelle `tenants` muss in Prod nachgewiesen und ggf. im Migrationsledger nachgezogen werden (nur nach Freigabe). Die Rolle von `organizations` (Billing) muss definiert oder übergeleitet werden. |
| B | `organizations` wird die kanonische Isolationsgrenze. | Passt zu Stripe/`subscriptions`. RLS-Helper und ein Großteil der Policies sind heute tenant-basiert und müssten umgebaut werden. Höheres Risiko und höherer Aufwand. |
| C | Hybrid: `organizations` = Schulträger (Vertrag, Billing), `tenants` = Schule (Datenisolation). Beziehung und Policies müssten festgeschrieben werden. | Nutzt beide vorhandenen Modelle. Braucht eine klare Zuordnung, Tests und Dokumentation. Ohne das bleiben zwei Wahrheiten nebeneinander. |
| D | Ein drittes, schulspezifisches Mandantenmodell. | Widerspricht dem Auftrag, keine parallele Plattform zu bauen. Wird hier nicht empfohlen. |

## 3. Empfehlung (Vorschlag, keine Entscheidung)

**Vorschlag: Option C prüfen, Option D verwerfen.**

Begründung aus dem Bestand, nicht aus einer Live-Messung:

- Die Datentrennung ist bereits um `tenants` / `is_tenant_member` herum gebaut.
- Billing und Entitlements sind um `organizations` / `subscriptions` herum gebaut.
- Ein Schulträger mit mehreren Schulen ist ein typisches B2G-Muster und würde diese Trennung fachlich nutzen.

Vor einer Festlegung muss die Live-Messung zeigen, ob `tenants` existiert, welches Schema sie hat und welchen RLS- und Grant-Status beide Modelle in Produktion haben.

Solange die Entscheidung offen ist, sollte kein Schul-Schema gebaut werden, das sich auf ein drittes `school_id` ohne Bezug zu den bestehenden Tabellen stützt.

## 4. Offene Entscheidung für Dominik

Bitte festlegen:

1. Option A, B oder C – oder eine begründete Alternative, die kein drittes Modell einführt?
2. Darf die rein lesende Abfrage [RLS_MESSUNG.sql](./RLS_MESSUNG.sql) in der Produktionsdatenbank ausgeführt werden (selbst oder durch Freigabe eines Lesezugriffs)?
3. Soll `org_units` als Hierarchie Schulträger / Schule / Klasse geprüft werden, oder bleibt das außen vor, bis das Kernmodell steht?

Keine dieser Entscheidungen ist durch diesen Dokumentations-PR getroffen.
