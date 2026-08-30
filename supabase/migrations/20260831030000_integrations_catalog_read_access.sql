-- Integrations-Katalog für eingeloggte Nutzer lesbar machen.
--
-- BEFUND (gemessen 2026-08-30 gegen das Live-Projekt)
--
-- `public.integrations` hatte RLS aktiviert, aber **null Policies** und für
-- `authenticated` **kein SELECT-Recht**. Die Tabelle enthält fünf Zeilen,
-- alle `enabled = true`. `IntegrationMarketplaceView` fragt sie clientseitig
-- ab — der Nutzer sah deshalb eine leere Seite, obwohl der Katalog gefüllt
-- ist. Die Ansicht verschluckt den Fehler zusätzlich (`if (!error) …`), also
-- gab es nicht einmal eine Meldung.
--
-- WARUM EIN LESEZUGRIFF HIER UNBEDENKLICH IST
--
-- `integrations` ist ein globaler Produktkatalog — Slack, Microsoft Teams,
-- PagerDuty, n8n, Zapier — mit Name, Beschreibung, Icon, Doku-Link und einem
-- `auth_type`-Etikett. Die Tabelle hat **keine** `tenant_id` und enthält
-- **keine** Zugangsdaten: Die tenant-spezifischen Verbindungen samt Secrets
-- liegen in `connectors` und sind davon nicht berührt.
--
-- Deshalb bewusst eng gefasst:
--   * nur `authenticated`, nicht `anon` — die Ansicht liegt hinter dem Login
--   * nur lesend, kein Schreibrecht — der Katalog wird nicht vom Client gepflegt
--   * nur `enabled is true` — abgeschaltete Einträge bleiben unsichtbar
--     (`enabled` ist nullable, deshalb `is true` statt `= true`)

-- RLS zuerst, und zwar zwingend.
--
-- In Produktion ist RLS auf dieser Tabelle bereits aktiv — aber **keine
-- Migration im Repo schaltet es je ein**. `20260706010000_api_and_webhooks.sql`
-- legt die Tabelle an, ohne RLS; aktiviert wurde es irgendwann direkt in der
-- Live-Datenbank. Eine frische Datenbank (lokales `db reset`, CI) hat die
-- Tabelle deshalb ohne RLS.
--
-- Ohne diese Zeile würde das Leserecht unten dort **jede** Zeile sichtbar
-- machen, auch abgeschaltete — die Policy greift nur bei aktivem RLS. In
-- Produktion ist der Befehl ein wirkungsloser No-op; auf einer frischen
-- Datenbank ist er der Unterschied zwischen „Katalog" und „alles offen".
-- Lokal gegen Postgres 16 nachgestellt und belegt.
alter table public.integrations enable row level security;

grant select on public.integrations to authenticated;

drop policy if exists integrations_read_enabled on public.integrations;

create policy integrations_read_enabled
on public.integrations
as permissive
for select
to authenticated
using (enabled is true);
