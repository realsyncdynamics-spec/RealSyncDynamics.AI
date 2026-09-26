# C2PA Phase 3.1 — Runbook: Signieren & Einbetten (Infra-Session)

**Status:** Umsetzungs-Runbook · **Datum:** 2026-09-26
**Voraussetzung:** P3.0 gemergt (`src/lib/provenance/c2paManifest.ts`, `buildC2paManifestDefinition()`).
**Freigegebene Entscheidungen (Vorlage `c2pa-phase3-entscheidungsvorlage.md`):** A1 · B1→B3 · C1 · D1+D2 · additiv.

> **Session-Scope:** Dieses Runbook ist Doku. Die Umsetzung berührt `services/`,
> `supabase/` und `package.json` einer **Infra-Session** (nicht der Website-
> Session; siehe `CLAUDE.md` → „Website bauen — Scope"). Dort `.mcp.json` mit
> Supabase-Servern setzen und `npm install` ist erlaubt.

---

## 0. Was P3.0 bereits liefert

`buildC2paManifestDefinition(input)` erzeugt deterministisch die **C2PA-Manifest-
Definition** (claim_generator, `c2pa.actions`, custom-Assertion
`com.realsyncdynamics.provenance` mit `latest_hash` der internen Ed25519-Kette).
P3.1 signiert und bettet diese Definition ein — es baut sie **nicht** neu.

## 1. Abhängigkeit & Ort (Entscheidung A1)

- Ziel-Service: **`services/realsync-evidence-runtime`** (Node/TS, Container).
- Dependency: **`c2pa-node`** (native Bindings auf `c2pa-rs`). In `package.json`
  des Service ergänzen, `npm install`, Container-Build/CI anpassen (native Build-
  Tools müssen im Image sein).
- **Vor Implementierung verifizieren** (nicht aus dem Gedächtnis): exakter
  Paketname/-version, API-Form (`ManifestBuilder` / `Builder`, `sign`/`sign_file`),
  unterstützte Formate der gepinnten Version. Ergebnis der Prüfung oben in dieser
  Datei als „Verifiziert am … gegen c2pa-node@x.y.z" festhalten.
- **Nicht** in Deno-Edge-Functions signieren (kein Rust/native in Deno). Die
  Edge-Function `provenance` ruft den Service auf bzw. der Service wird vom
  Custody-Append angestoßen.

## 2. Zertifikat & Schlüssel (Entscheidung B: B1 jetzt, B3 später)

- **B1 (jetzt, Test):** self-signed Zertifikatskette für die Signatur erzeugen
  (Signatur-Algorithmus passend zu c2pa-node, z. B. Ed25519 oder ES256 — gegen
  die Lib-Vorgabe prüfen). Ablage als **Secrets** (Supabase Function Secrets bzw.
  Service-Env), **nie im Repo**:
  - `C2PA_SIGN_CERT` (PEM-Kette), `C2PA_SIGN_KEY` (PEM privat), `C2PA_SIGN_ALG`.
- **B3 (Produktion):** Zertifikat einer **C2PA-Trust-List-CA**. Reiner Secret-/
  Vertragswechsel, kein Code. Bis dahin gilt: Signatur kryptografisch gültig,
  Aussteller in Fremd-Viewern **„untrusted"** — ehrlich in FAQ/Marketing
  ausweisen (Claims-vs-Runtime).

## 3. Signier-Endpoint (Service)

1. Input: `asset_ref`, Medien-Bytes (oder Referenz), `format` (C1: `image/jpeg` |
   `image/png` — mit `isSupportedFormat` aus P3.0 gaten), plus die interne Kette.
2. Definition bauen: `buildC2paManifestDefinition({ … })` (P3.0-Kern; ggf. als
   geteiltes Modul in den Service ziehen — Kanonik bit-identisch halten).
3. Mit `c2pa-node` signieren: Builder aus der Definition, Signer aus B1-Secrets.
4. **D1 (Einbettung):** Manifest in die Mediendatei einbetten (JUMBF), wenn das
   Format es erlaubt.
5. **D2 (Sidecar-Fallback):** wenn Einbettung nicht möglich → `.c2pa`-Sidecar
   neben dem Asset ablegen; Verknüpfung persistieren.
6. Persistenz: erzeugtes Manifest + Signaturzustand an das bestehende
   `provenance_manifests`/`provenance_custody_events`-Modell **additiv** anhängen
   (kein Ersatz des Ed25519-Modells, Entscheidung E). Additiv-Migration nur falls
   neue Spalten nötig (z. B. `c2pa_manifest_uri`, `c2pa_embedded boolean`).

## 4. Verifizieren

- **Serverseitig:** mit `c2pa-node` das eingebettete/sidecar-Manifest lesen +
  validieren (Signatur, Hash-Bindung an die Bytes, Trust-Status des Ausstellers).
- **Clientseitig:** `c2pa` Web-SDK (WASM, **nur Lesen/Prüfen** — stabil) in der
  ProvenanceView anzeigen: „C2PA gültig · Aussteller trusted/untrusted". Der
  Cross-Link (`com.realsyncdynamics.provenance.latest_hash`) gegen die interne
  Kette prüfen → beide Nachweise stimmen überein.

## 5. Tests

- **Pure/deterministisch (bereits in P3.0):** Definitionsbau. Erweitern falls
  neue Mapping-Fälle.
- **Service-Integration (P3.1):** signieren → lesen → verifizieren Round-Trip auf
  einem Test-JPEG/PNG mit dem B1-Zertifikat; Manipulation am Byte-Inhalt muss die
  C2PA-Validierung UND (über den Cross-Link) die interne Kette brechen.
- **Format-Gate:** nicht unterstützte Formate (PDF/MP4 in C1) sauber ablehnen.

## 6. Reihenfolge / PRs (klein halten)

1. Dependency + B1-Zertifikats-Handling + Signier-Endpoint (kein UI). Additive
   Migration nur wenn nötig.
2. Verifizieren (Service) + Round-Trip-Tests.
3. UI (ProvenanceView): C2PA-Status + Download des signierten Assets/Sidecars.
4. (Betrieb) B3-Zertifikat einspielen + FAQ/Marketing-Text ehrlich schärfen.

## 7. Risiken

- **Native Build in CI/Container** (c2pa-node) — Image + CI-Runner müssen die
  Toolchain haben; sonst schlägt der Service-Build fehl.
- **Trust bis B3** — ohne getrustetes Zertifikat kein Außenwert; klar
  kommunizieren.
- **Format-Scope** — C1 nur Bilder; PDF (C2)/Video (C3) sind Folgephasen mit
  eigener Formatverifikation.
- **Schema-Drift** — das exakte c2pa-node-Definitions-/Assertions-Schema gegen die
  gepinnte Version prüfen; die P3.0-Definition ist die interne Abbildung, nicht
  deren Schema-Autorität.
