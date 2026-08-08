-- WIEDERHERGESTELLT aus der Prod-Migrations-History (2026-08-02).
-- Direkt auf Prod angewendet, nie ins Repo committet (Drift). Inhalt 1:1 aus
-- supabase_migrations.schema_migrations (Version 20260715105402).
--
-- ACHTUNG — historischer Stand: die hier angelegte Policy "owner full access"
-- ist USING(true)/WITH CHECK(true), also faktisch offen fuer jeden
-- authentifizierten Nutzer. Das wurde in 20260720124405 korrigiert
-- (Einschraenkung auf super_admin + service_role). Die Datei bleibt bewusst
-- unveraendert, damit `supabase db reset` die reale Historie nachspielt.
-- Nicht als Vorlage fuer neue Tabellen verwenden.

-- Document Vault: zentrale Ablage für alle in Chats hochgeladenen/besprochenen Dokumente & Fotos
create table if not exists public.document_vault (
  id uuid primary key default gen_random_uuid(),
  captured_date date not null default current_date,
  title text not null,
  category text not null check (category in ('dokument','foto','sonstiges')),
  case_reference text, -- z.B. Az. 3 F 359/25, Az. 3 Ga 3/26 etc.
  description text,
  storage_path text, -- Pfad im Supabase Storage Bucket
  source_chat_note text, -- Kontext, in welchem Chat/Anlass es entstand
  created_at timestamptz not null default now()
);

comment on table public.document_vault is 'Zentrale Übersicht aller fotografierten/hochgeladenen Dokumente aus Chats mit Claude, sortiert nach Datum und Kategorie.';

create index if not exists idx_document_vault_date on public.document_vault (captured_date desc);
create index if not exists idx_document_vault_category on public.document_vault (category);

alter table public.document_vault enable row level security;

create policy "owner full access" on public.document_vault
  for all
  using (true)
  with check (true);
