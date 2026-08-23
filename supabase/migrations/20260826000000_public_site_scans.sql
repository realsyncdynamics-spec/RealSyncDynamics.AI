-- Öffentlicher Website-Scan: Landingpage → Scan → Ergebnis → Konto.
--
-- ## Was hier neu ist — und was ausdrücklich nicht
--
-- Die Analyse selbst ist **nicht** neu. Sie läuft über `analyzeObservation()`
-- und `computeScores()` aus `packages/siteos-core` — dieselbe Engine, die
-- das SiteOS-Monitoring nach jedem Deployment fährt. Neu ist allein der
-- Zugang: derselbe Prüfstand, ohne Anmeldung, für eine fremde Domain.
--
-- Diese Tabelle hält das Ergebnis zwischen dem Scan und der Registrierung.
-- Danach gehört es einem Mandanten und folgt dessen Aufbewahrung.
--
-- ## Warum eine Zeile ohne tenant_id vertretbar ist
--
-- Das Schema baut auf `tenant_id` und RLS auf; eine Zeile ohne Mandanten ist
-- dort normalerweise ein Fehler. Hier ist sie der Gegenstand: Ein Scan, den
-- ein anonymer Besucher ausgelöst hat, gehört per Definition niemandem, bis
-- ihn jemand übernimmt. Das ist genau der Fall, den `anon_chat_runs`
-- (20260606000000) und `siteos_anonymous_builds` (20260822180000) bereits
-- führen — dasselbe Muster, keine neue Erfindung.
--
-- ## Zugriffsmodell
--
-- Zwei Wege, bewusst getrennt:
--
--   * **Vor der Übernahme** (`tenant_id IS NULL`): kein Weg über PostgREST.
--     Die Policies unten greifen nur bei gesetztem `tenant_id`; eine anonyme
--     Zeile erfüllt keine von ihnen. Erreichbar ist sie ausschliesslich mit
--     service_role aus einer Edge Function, und die verlangt die
--     Scan-Kennung. Damit ist die Forderung erfüllt, dass eine Kennung nicht
--     genügt, um *beliebige* fremde Berichte zu holen: Es gibt keine
--     Auflistung und keine Aufzählbarkeit, nur den Direktzugriff auf eine
--     122-Bit-Zufallskennung, die der Besucher selbst erzeugt hat.
--   * **Nach der Übernahme**: gewöhnliche Mandantentrennung über
--     `is_tenant_member()` — wie jede andere Geschäftstabelle.
--
-- ## Was NICHT gespeichert wird
--
-- Kein HTML der geprüften Seite (Art. 5 Abs. 1 lit. c DSGVO —
-- Datenminimierung). Persistiert werden nur die abgeleiteten Befunde, die
-- Kennzahlen und die erkannten Technologien. Die IP des Besuchers liegt nur
-- als Hash vor, wie bei `anon_chat_runs` und `waitlist_signups`.

BEGIN;

-- ============================================================
-- §1 Die Scan-Zeile
-- ============================================================

CREATE TABLE IF NOT EXISTS public.public_site_scans (
  -- Zugleich die Kennung, die der Browser behält, und damit ein
  -- Zugriffsmittel: Wer sie hat, erreicht den Bericht. Eine UUIDv4 aus
  -- gen_random_uuid() trägt 122 Bit Zufall — nicht ratbar, nicht aufzählbar.
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Geprüftes Ziel. `url` ist die nach Weiterleitungen tatsächlich gelesene
  -- Adresse, `domain` der Host davon.
  url               TEXT NOT NULL,
  domain            TEXT NOT NULL,
  http_status       INTEGER,

  -- Ergebnis. `report` ist der vollständige Kundenbericht, wie ihn
  -- `buildPublicScanReport()` erzeugt; `findings` die Rohbefunde, aus denen
  -- er entstanden ist. Beides zusammen macht jede Zahl im Bericht auf
  -- einzelne, benannte Befunde zurückführbar — die Bedingung dafür, ihn
  -- überhaupt in einem Audit zu zeigen.
  overall_score     INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  report            JSONB NOT NULL,
  findings          JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Version der Auswertung. Ohne sie lassen sich zwei Berichte aus
  -- verschiedenen Monaten nicht vergleichen, weil unklar bliebe, ob sich
  -- die Website oder die Messlatte geändert hat.
  engine_version    TEXT NOT NULL,

  -- Missbrauchsabwehr und Zuordnung im Prüfpfad. Klartext-IP wird nie
  -- gespeichert.
  ip_hash           TEXT,

  -- Übernahme in ein Konto. Beide Felder zusammen oder keines — eine halb
  -- übernommene Zeile wäre ein Zustand, den niemand auflösen kann.
  tenant_id         UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  claimed_at        TIMESTAMPTZ,
  CONSTRAINT public_site_scans_claim_complete CHECK (
    (tenant_id IS NULL AND claimed_at IS NULL)
    OR (tenant_id IS NOT NULL AND claimed_at IS NOT NULL)
  ),

  -- Verfall der nicht übernommenen Zeilen. Daten ohne Zweckbindung und ohne
  -- Zuordnung dürfen nicht unbegrenzt liegen (Art. 5 Abs. 1 lit. e DSGVO).
  -- Sieben Tage, wie bei `siteos_anonymous_builds`. Ein übernommener Scan
  -- verfällt nicht mehr — er gehört dann einem Mandanten.
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verfallslauf, Missbrauchsabwehr und die Dashboard-Liste je Mandant sind
-- die einzigen Abfragen, die nicht über den Primärschlüssel gehen.
CREATE INDEX IF NOT EXISTS public_site_scans_expiry_idx
  ON public.public_site_scans (expires_at)
  WHERE claimed_at IS NULL;
CREATE INDEX IF NOT EXISTS public_site_scans_ip_idx
  ON public.public_site_scans (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS public_site_scans_tenant_idx
  ON public.public_site_scans (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- ============================================================
-- §2 Mandantentrennung
-- ============================================================

ALTER TABLE public.public_site_scans ENABLE ROW LEVEL SECURITY;

-- Lesen: nur der Mandant, dem der Scan gehört. Die Bedingung
-- `tenant_id IS NOT NULL` steht ausdrücklich da, damit eine noch nicht
-- übernommene Zeile unter keinen Umständen über PostgREST sichtbar wird —
-- auch dann nicht, wenn `is_tenant_member(NULL)` sich einmal anders
-- verhalten sollte als heute.
DROP POLICY IF EXISTS "public_site_scans tenant-select" ON public.public_site_scans;
CREATE POLICY "public_site_scans tenant-select" ON public.public_site_scans
  FOR SELECT USING (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id));

-- Schreiben ausschliesslich aus Edge Functions. Der Browser legt keinen
-- Scan an und übernimmt keinen — beides geht über eine Function, die die
-- Kennung prüft.
DROP POLICY IF EXISTS "public_site_scans service-all" ON public.public_site_scans;
CREATE POLICY "public_site_scans service-all" ON public.public_site_scans
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- §3 Dokumentation am Objekt
-- ============================================================

COMMENT ON TABLE public.public_site_scans IS
  'Ergebnisse des kostenlosen Website-Scans vor der Registrierung. tenant_id ist NULL, bis der Scan uebernommen wird; anonyme Zeilen sind ueber PostgREST nicht erreichbar (die SELECT-Policy verlangt tenant_id IS NOT NULL). Kein HTML gespeichert (Art. 5 Abs. 1 lit. c DSGVO), Verfall nach 7 Tagen (Art. 5 Abs. 1 lit. e DSGVO).';
COMMENT ON COLUMN public.public_site_scans.id IS
  'Scan-Kennung und zugleich Zugriffsmittel — wer sie kennt, erreicht den Bericht ueber die Edge Function. 122 Bit Zufall, nicht aufzaehlbar.';
COMMENT ON COLUMN public.public_site_scans.report IS
  'Kundenbericht aus buildPublicScanReport(): sechs Kategorien ueber acht Pruefdimensionen. Enthaelt bewusst keine Konformitaetsaussage.';
COMMENT ON COLUMN public.public_site_scans.engine_version IS
  'Version der Auswertung. Ohne sie sind zwei Berichte verschiedener Staende nicht vergleichbar.';
COMMENT ON COLUMN public.public_site_scans.tenant_id IS
  'NULL bis zur Uebernahme. Danach gewoehnliche Mandantentrennung ueber is_tenant_member().';

COMMIT;
