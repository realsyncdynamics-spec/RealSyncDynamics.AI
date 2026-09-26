# C2PA Phase 3 — Entscheidung & Runbook P3.1 (Signieren & Einbetten)

**Stand:** 2026-09-26 · **Voraussetzung:** P3.0 gemergt (`src/lib/provenance/c2paManifest.ts`).

> Umsetzung berührt `services/`, `supabase/`, `package.json` → **Infra-Session**,
> nicht Website-Session (`CLAUDE.md` → Scope). Dort ist `npm install` erlaubt.

## Entscheidung (freigegeben)

Ist-Modell: Ed25519-Custody-Kette, „C2PA-angelehnt", **nicht** standardkonform
(kein COSE_Sign1 / X.509 / JUMBF). Phase 3 ergänzt eine portable C2PA-Ausgabe
**daneben** — der interne Prüfpfad bleibt.

| # | Frage | Wahl | Grund |
|---|---|---|---|
| A | Bibliothek/Laufzeit | `c2pa-node` im Evidence-Runtime-Service | Deno-Edge kann kein Rust; reife Bindings |
| B | Zertifikat | B1 self-signed jetzt → B3 Trust-List-CA für Produktion | B3 = Vertrags-/Secret-Schritt, kein Code |
| C | Medien-Scope | JPEG/PNG | kleinster Einstieg; PDF/Video später |
| D | Ablage | JUMBF-Einbettung, `.c2pa`-Sidecar als Fallback | wie die Referenz-Lib |
| E | Verhältnis zu Ed25519 | additiv | kein Bruch bestehender Verträge |

## Runbook P3.1

1. **Dependency** `c2pa-node` in `services/realsync-evidence-runtime`; Container/CI
   brauchen die native Toolchain. **Vorab verifizieren** (nicht aus dem
   Gedächtnis): Paketversion, API (`Builder`/`sign`), Formatliste — Ergebnis hier
   mit „verifiziert gegen c2pa-node@x.y.z" eintragen.
2. **Secrets (B1)**, nie im Repo: `C2PA_SIGN_CERT` (PEM-Kette), `C2PA_SIGN_KEY`,
   `C2PA_SIGN_ALG` (gegen Lib-Vorgabe prüfen).
3. **Signier-Endpoint (Service, zustandslos):** Format mit `isSupportedFormat`
   gaten → `buildC2paManifestDefinition()` (P3.0, nicht neu bauen) → mit
   `c2pa-node` signieren → einbetten (D1) oder Sidecar (D2) → **signiertes
   Artefakt zurückgeben, nichts persistieren.** Der Service hat nur
   `EVIDENCE_RUNTIME_DATABASE_URL`; Schreibzugriffe auf `provenance_manifests` /
   `provenance_custody_events` sind der Edge-Function `provenance` vorbehalten
   (Backbone-Migration). **Die Edge-Function** ruft den Service auf und schreibt
   das Ergebnis additiv (Migration nur falls nötig, z. B. `c2pa_manifest_uri`,
   `c2pa_embedded`). Keine Service-Role im Container.
4. **Verifizieren:** serverseitig mit `c2pa-node` (Signatur, Hash-Bindung,
   Trust-Status); clientseitig `c2pa` Web-SDK (WASM, nur lesen) in der
   ProvenanceView: „C2PA gültig · Aussteller trusted/untrusted". Cross-Link
   `com.realsyncdynamics.provenance.latest_hash` gegen die interne Kette prüfen.
5. **Tests — beide Nachweise getrennt:** Signier-Round-Trip auf Test-JPEG/PNG.
   Byte-Manipulation → C2PA-Validierung schlägt fehl, **interne Kette bleibt
   intakt** (sie hasht gespeicherte Event-Felder, nicht Medien-Bytes). Separat:
   manipulierter Cross-Link (`latest_hash`) bzw. verändertes Custody-Event →
   Mismatch bzw. gebrochene interne Kette. Nicht unterstützte Formate sauber
   abgelehnt.
6. **PR-Reihenfolge:** (1) Dependency + Secrets + Endpoint · (2) Verifizieren +
   Tests · (3) UI-Status + Download · (4) B3 einspielen, FAQ/Marketing ehrlich.

## Risiken

- Native Build in CI/Container; ohne Toolchain bricht der Service-Build.
- Bis B3 ist der Aussteller „untrusted" — so auch kommunizieren (Claims-vs-Runtime).
- Schema-Drift: die P3.0-Definition ist interne Abbildung, nicht Schema-Autorität.
