#!/usr/bin/env node
// Lokaler Probe fuer RSD-011: eigener Postgres-Container, keine Live-DB.
// Stubs fuer gdpr_audits / sales_leads, Migration zweimal anwenden, Funktionen
// und Trigger pruefen, Rollback gegen leere Tabelle, Container entfernen.

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const migration = resolve(repo, 'supabase/migrations/20261114104500_rsd011_restore_audit_email_drip.sql');
const rollback = resolve(repo, 'supabase/rollback/20261114104500_rsd011_restore_audit_email_drip.sql');

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function dockerAvailable() {
  const r = spawnSync('docker', ['info'], { encoding: 'utf8' });
  return r.status === 0;
}

const stubs = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  followup_doi_confirmed_at timestamptz,
  marketing_consent_revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.gdpr_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  sales_lead_id uuid REFERENCES public.sales_leads(id),
  marketing_consent boolean,
  marketing_consent_revoked_at timestamptz
);
`;

const probes = `
DO $$
DECLARE
  v_lead uuid;
  v_audit uuid;
  v_drip uuid;
  v_cnt int;
  r record;
BEGIN
  IF to_regclass('public.audit_email_drip') IS NULL THEN
    RAISE EXCEPTION 'Tabelle audit_email_drip fehlt nach der Migration';
  END IF;
  IF to_regprocedure('public.audit_email_drip_due(integer)') IS NULL THEN
    RAISE EXCEPTION 'Funktion audit_email_drip_due fehlt';
  END IF;
  IF to_regprocedure('public.audit_email_drip_advance(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Funktion audit_email_drip_advance fehlt';
  END IF;
  IF to_regprocedure('public.audit_email_drip_create_for_audit()') IS NULL THEN
    RAISE EXCEPTION 'Funktion audit_email_drip_create_for_audit fehlt';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'gdpr_audits' AND t.tgname = 'trg_audit_create_drip'
  ) THEN
    RAISE EXCEPTION 'Trigger trg_audit_create_drip fehlt';
  END IF;

  INSERT INTO public.sales_leads (followup_doi_confirmed_at)
  VALUES (now()) RETURNING id INTO v_lead;
  INSERT INTO public.gdpr_audits (email, sales_lead_id, marketing_consent)
  VALUES ('probe@example.com', v_lead, true) RETURNING id INTO v_audit;
  SELECT count(*) INTO v_cnt FROM public.audit_email_drip WHERE audit_id = v_audit;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'Trigger hat % Drip-Zeilen angelegt, erwartet 1', v_cnt;
  END IF;

  -- noch nicht faellig (next_send_at = now()+3 days)
  SELECT count(*) INTO v_cnt FROM public.audit_email_drip_due(50);
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'due() lieferte % Zeilen vor Faelligkeit', v_cnt;
  END IF;

  UPDATE public.audit_email_drip SET next_send_at = now() - interval '1 hour' WHERE audit_id = v_audit
    RETURNING id INTO v_drip;
  SELECT count(*) INTO v_cnt FROM public.audit_email_drip_due(50);
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'due() lieferte % Zeilen mit Consent+DOI, erwartet 1', v_cnt;
  END IF;

  UPDATE public.sales_leads SET followup_doi_confirmed_at = NULL WHERE id = v_lead;
  SELECT count(*) INTO v_cnt FROM public.audit_email_drip_due(50);
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'due() lieferte % Zeilen ohne DOI — Consent-Gate greift nicht', v_cnt;
  END IF;
  UPDATE public.sales_leads SET followup_doi_confirmed_at = now() WHERE id = v_lead;

  PERFORM public.audit_email_drip_advance(v_drip, NULL);
  SELECT current_step INTO v_cnt FROM public.audit_email_drip WHERE id = v_drip;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'advance() setzte current_step auf %, erwartet 1', v_cnt;
  END IF;

  RAISE NOTICE 'RSD-011 lokaler Probe erfolgreich';
END $$;
`;

if (!dockerAvailable()) {
  // Exit 2 statt 0: Ein uebersprungener Lauf darf nicht als bestandene
  // Datenbankprobe gelten (gruener Prozessstatus ≠ ausgefuehrte Probe).
  console.error('RSD-011 Probe NICHT ausgefuehrt: docker ist nicht verfuegbar.');
  process.exit(2);
}

const name = `rsd011-probe-${Date.now()}`;
const pw = 'probe';
let started = false;
try {
  console.log(`Starte lokalen Postgres-Container ${name} (keine Live-DB) ...`);
  sh(`docker run -d --name ${name} -e POSTGRES_PASSWORD=${pw} postgres:17-alpine`);
  started = true;
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const r = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8' });
    if (r.status === 0) { ready = true; break; }
    execSync(process.platform === 'win32' ? 'powershell -Command "Start-Sleep -Seconds 2"' : 'sleep 2');
  }
  if (!ready) throw new Error('Postgres im Container wurde nicht rechtzeitig bereit');

  const apply = (label, sql) => {
    const r = spawnSync('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
      input: sql,
      encoding: 'utf8',
    });
    if (r.status !== 0) {
      throw new Error(`${label} fehlgeschlagen:\n${r.stderr || r.stdout}`);
    }
    return r.stdout;
  };

  apply('stubs', stubs);
  const fwd = readFileSync(migration, 'utf8');
  apply('migration 1', fwd);
  apply('migration 2 (Idempotenz)', fwd);
  apply('probes', probes);
  apply('rollback bei vorhandenen Zeilen', readFileSync(rollback, 'utf8'));
  apply('rollback: Funktionen weg, Tabelle bleibt', `
    DO $$ BEGIN
      IF to_regprocedure('public.audit_email_drip_due(integer)') IS NOT NULL THEN
        RAISE EXCEPTION 'Rollback hat audit_email_drip_due nicht entfernt';
      END IF;
      IF to_regclass('public.audit_email_drip') IS NULL THEN
        RAISE EXCEPTION 'Rollback hat die Tabelle trotz vorhandener Zeilen gedroppt';
      END IF;
    END $$;
  `);
  apply('tabelle leeren', 'DELETE FROM public.audit_email_drip;');
  apply('rollback bei leerer Tabelle', readFileSync(rollback, 'utf8'));
  apply('rollback: leere Tabelle entfernt', `
    DO $$ BEGIN
      IF to_regclass('public.audit_email_drip') IS NOT NULL THEN
        RAISE EXCEPTION 'Rollback hat die leere Tabelle nicht gedroppt';
      END IF;
    END $$;
  `);
  console.log('RSD-011 lokaler Probe: Migration (2x), Trigger, Consent-Gate, advance, Rollback — ok.');
} catch (e) {
  console.error('RSD-011 lokaler Probe fehlgeschlagen:', e.message || e);
  process.exit(1);
} finally {
  if (started) {
    try { sh(`docker rm -f ${name}`); } catch { /* ignore */ }
  }
}
