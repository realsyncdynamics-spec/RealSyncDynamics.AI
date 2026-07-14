-- Provenance — Signatur-Algorithmus je Signatur festhalten (Phase 2a).
--
-- Führt Ed25519 (asymmetrisch, extern prüfbar) neben der bisherigen HMAC-
-- Signatur ein. Damit die Verifizierung weiß, WIE eine gespeicherte Signatur zu
-- prüfen ist, wird der Algorithmus je Event/Manifest festgehalten.
--
-- Rein additiv, nullable: Bestandssignaturen (HMAC) haben signature_alg = NULL
-- und werden von der Verifizierung als 'hmac-sha256' (Legacy) behandelt. Neue
-- Signaturen setzen 'ed25519'.

ALTER TABLE public.provenance_custody_events
    ADD COLUMN IF NOT EXISTS signature_alg TEXT
    CHECK (signature_alg IN ('ed25519', 'hmac-sha256'));

ALTER TABLE public.provenance_manifests
    ADD COLUMN IF NOT EXISTS signature_alg TEXT
    CHECK (signature_alg IN ('ed25519', 'hmac-sha256'));

COMMENT ON COLUMN public.provenance_custody_events.signature_alg IS
    'Signaturverfahren dieser Zeile: ed25519 (asymmetrisch, mit öffentlichem Schlüssel extern prüfbar) oder hmac-sha256 (Legacy). NULL = Legacy-HMAC.';
