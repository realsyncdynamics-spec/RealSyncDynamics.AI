-- Provenance-Backbone — echter Herkunftsnachweis für Assets (C2PA-angelehntes
-- Datenmodell, RealSync-signiert; nicht COSE_Sign1/X.509-Interop).
--
-- Ersetzt die bisherigen Mock-Flags (`c2pa: true`) durch eine überprüfbare
-- Struktur:
--   provenance_manifests        1 Manifest pro Asset (Kopf der Custody-Kette)
--   provenance_custody_events   append-only Hash-Kette pro Asset
--
-- Schreibpfade laufen ausschließlich über die Edge-Function `provenance`
-- (service_role). Lesepfade sind RLS-geschützt (Tenant-Mitglieder).
-- Custody-Events sind unveränderlich (Trigger blockt UPDATE/DELETE) — genau
-- das macht nachträgliche Manipulation nachweisbar.

-- ─── 1. Manifest-Store ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.provenance_manifests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    -- Tenant-eindeutige Asset-Referenz (z.B. "AST-2026-0007").
    asset_ref       TEXT NOT NULL,
    -- SHA-256 des zuletzt registrierten Inhalts (Lowercase-Hex).
    content_sha256  TEXT NOT NULL,
    -- Herausgeber-Kennung (Tenant/Actor/Signing-Key-Subject).
    issuer          TEXT NOT NULL,
    -- Referenz auf den verwendenden Signing-Key (Vault-Name o.ä.).
    signing_key_id  TEXT,
    -- Signatur über den jüngsten Claim (base64), optional bis erste Signatur.
    signature       TEXT,
    -- Kopf der Custody-Kette = event_hash des jüngsten Events.
    latest_hash     TEXT NOT NULL,
    -- Zuletzt berechneter Trust-Score (0–100) und Manipulationszustand.
    trust_score     INT,
    tamper_state    TEXT NOT NULL DEFAULT 'intact'
                        CHECK (tamper_state IN ('intact', 'tampered', 'unverifiable')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, asset_ref)
);

CREATE INDEX IF NOT EXISTS idx_provenance_manifests_tenant
    ON public.provenance_manifests(tenant_id);

-- ─── 2. Custody-Events (append-only Hash-Kette pro Asset) ────────────────────
CREATE TABLE IF NOT EXISTS public.provenance_custody_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_id     UUID NOT NULL REFERENCES public.provenance_manifests(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL,
    -- Lückenlos aufsteigend pro Manifest (1, 2, 3, …).
    seq             INT NOT NULL,
    action          TEXT NOT NULL
                        CHECK (action IN ('registered', 'updated', 'licensed', 'audited')),
    actor           TEXT NOT NULL,
    content_sha256  TEXT NOT NULL,
    event_ts        TIMESTAMPTZ NOT NULL,
    -- Verkettung: event_hash des Vorgängers (NULL beim ersten Event).
    prev_hash       TEXT,
    -- sha256(canonicalClaimBytes(claim)) — siehe src/lib/provenance.
    event_hash      TEXT NOT NULL,
    signature       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (manifest_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_provenance_custody_manifest
    ON public.provenance_custody_events(manifest_id, seq);
CREATE INDEX IF NOT EXISTS idx_provenance_custody_tenant
    ON public.provenance_custody_events(tenant_id);

-- ─── 3. Unveränderlichkeit der Custody-Events erzwingen ──────────────────────
CREATE OR REPLACE FUNCTION public.provenance_custody_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'provenance_custody_events sind unveränderlich (append-only)';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_provenance_custody_immutable ON public.provenance_custody_events;
CREATE TRIGGER trg_provenance_custody_immutable
    BEFORE UPDATE OR DELETE ON public.provenance_custody_events
    FOR EACH ROW EXECUTE FUNCTION public.provenance_custody_immutable();

-- ─── 4. RLS: Tenant-Mitglieder dürfen lesen; Schreiben nur service_role ──────
ALTER TABLE public.provenance_manifests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provenance_custody_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provenance_manifests tenant-select" ON public.provenance_manifests;
CREATE POLICY "provenance_manifests tenant-select" ON public.provenance_manifests
    FOR SELECT USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "provenance_custody tenant-select" ON public.provenance_custody_events;
CREATE POLICY "provenance_custody tenant-select" ON public.provenance_custody_events
    FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.provenance_manifests IS
    'Herkunftsnachweis pro Asset (Kopf der Custody-Kette). Lesen per RLS für Tenant-Mitglieder; Schreiben nur über Edge-Function provenance (service_role).';
COMMENT ON TABLE public.provenance_custody_events IS
    'Append-only Hash-Kette pro Asset. Unveränderlich (Trigger). Manipulation wird durch Re-Hashing in src/lib/provenance erkennbar.';

-- ─── 5. Entitlements: an die aktuellen Tarife binden (ab Agency) ─────────────
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('provenance.advanced', 'Herkunftsnachweis: Signatur, Chain-of-Custody, Trust-Score', 'boolean'),
    ('c2pa.export',         'Export signierter Provenance-/C2PA-Manifeste',               'boolean')
ON CONFLICT (key) DO NOTHING;

WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('agency',     'provenance.advanced', 1),
    ('agency',     'c2pa.export',         1),
    ('scale',      'provenance.advanced', 1),
    ('scale',      'c2pa.export',         1),
    ('enterprise', 'provenance.advanced', 1),
    ('enterprise', 'c2pa.export',         1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;
