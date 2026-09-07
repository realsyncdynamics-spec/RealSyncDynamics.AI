# C2PA Phase 3 — Entscheidungsvorlage: echte Standard-Interoperabilität

**Status:** Entwurf zur Entscheidung · **Datum:** 2026-09-06
**Betrifft:** Modul Provenance / C2PA (heute 80 %)

---

## 1. Ausgangslage (gemessen, nicht angenommen)

Der Herkunftsnachweis ist heute funktional vollständig — aber bewusst **„C2PA-angelehnt", nicht standardkonform**:

| Fähigkeit | Ist-Zustand |
|---|---|
| Ed25519-Signatur (asymmetrisch, öffentlicher Schlüssel) | ✅ `src/lib/provenance/signature.ts`, `sign.ts`, `pubkey`-Op |
| Custody-Auto-Erfassung bei Evidence-Snapshot | ✅ `_shared/provenanceCore.ts` |
| Externe/clientseitige Verifizierung ohne Server-Vertrauen | ✅ `independentlyVerifySignatures()`, `verify.ts` |
| Manifest-Kanonik | ✅ eigenes JSON-Schema (`canonicalClaim.ts`) |

**Was fehlt** (per `grep`: keine Treffer für `cose_sign` / `x509` / `jumbf` / `c2patool` / `c2pa-rs`):

- **C2PA-2.x-Manifeste** (JUMBF-Container) statt eigenem JSON
- **COSE_Sign1**-Signaturhülle statt roher Ed25519-Hex-Signatur
- **X.509-Zertifikatskette** + Trust-List-Prüfung statt einzelnem öffentlichem Schlüssel
- **Einbettung in Medien** (JPEG/PNG/PDF/MP4) statt nur DB-Kette
- Prüfbarkeit mit **Fremd-Tools** (Content Credentials Verify, `c2patool`, Adobe/CAI-Ökosystem)

**Kernaussage:** Phase 3 ersetzt das interne Modell **nicht** — sie stellt eine **zweite, portable, standardkonforme Ausgabe daneben**. Der interne Ed25519-Prüfpfad bleibt der Governance-Nachweis; das C2PA-Manifest ist die exportierbare, weltweit prüfbare Repräsentation.

---

## 2. Zu entscheidende Fragen

### Entscheidung A — Bibliothek & Laufzeit

C2PA-Signierung ist praktisch nur über die Referenz-Implementierung `c2pa-rs` (Rust) seriös umsetzbar. **Deno-Edge-Functions können kein Rust ausführen** (CLAUDE.md §2). Optionen:

| Option | Wo läuft es | Für | Wider |
|---|---|---|---|
| **A1 — Node-Service mit `c2pa-node`** | `services/realsync-evidence-runtime` (bestehender Container) | Reife Bindings, Signieren + Einbetten + Verifizieren, passt zur bestehenden Service-Ebene | Neue native Dependency; Container-Deploy nötig |
| **A2 — `c2patool`-CLI im Container** | derselbe Service, per Subprozess | Am nächsten an der Referenz, einfachste Aktualisierung | Prozess-Aufruf, Binary-Pflege |
| **A3 — `c2pa` WASM in Deno-Edge** | Edge-Function | Keine neue Ebene | WASM-Signierpfad unreif/instabil; Zertifikats-Handling in Edge heikel |
| **A4 — Eigenes COSE_Sign1 + JUMBF** | Edge/Node | Volle Kontrolle | Hoher Aufwand, Fehleranfällig, kein Ökosystem-Vertrauen — **nicht empfohlen** |

> **Empfehlung: A1** (`c2pa-node` im bestehenden Evidence-Runtime-Service). Verifizieren zusätzlich clientseitig über die `c2pa` Web-SDK (WASM, nur Lesen/Prüfen — das ist stabil).

### Entscheidung B — Zertifikat & Trust (die eigentliche Produkt-/Rechtsfrage)

Eine C2PA-Signatur ist nur so vertrauenswürdig wie ihr X.509-Zertifikat:

| Stufe | Bedeutung | Aufwand/Kosten |
|---|---|---|
| **B1 — Self-signed Test-Zertifikat** | Signatur kryptografisch gültig, Aussteller **„untrusted"** in Fremd-Viewern | sofort, 0 € |
| **B2 — Eigene interne CA** | konsistente Kette, aber nicht auf der öffentlichen C2PA-Trust-List | gering |
| **B3 — Zertifikat von einer C2PA-Trust-List-CA** | in Content Credentials Verify **„trusted"**, echter Außenwert | Vertrag/Kosten mit CA, Vorlaufzeit |

> **Empfehlung: B1 zum Bauen/Testen, B3 als benannte Voraussetzung für „Produktion mit Außenwirkung".** B3 ist ein Betreiber-/Vertragsschritt (wie das Ed25519-Secret in 2a) — Code ist trust-agnostisch, die Kette wird per Secret/Config eingespielt.

### Entscheidung C — Medien-Scope (Start)

| Scope | Formate | Bemerkung |
|---|---|---|
| **C1 — nur Bilder** | JPEG, PNG | häufigster Deepfake-/Creator-Fall, kleinster Einstieg |
| **C2 — Bilder + PDF** | + PDF | passt zu Compliance-Dokumenten/Evidence |
| **C3 — + Video/Audio** | + MP4/MOV, WAV/MP3 | größter Aufwand |

> **Empfehlung: C1 zuerst**, C2 direkt danach. (Exakte Formatliste der gewählten Lib-Version zur Implementierung verifizieren.)

### Entscheidung D — Einbettung vs. Sidecar

| Option | Für | Wider |
|---|---|---|
| **D1 — In die Mediendatei einbetten (JUMBF)** | eine Datei, überall prüfbar | verändert die Datei; nicht für alle Formate |
| **D2 — Sidecar-Manifest (`.c2pa`)** | Originaldatei unangetastet | zwei Dateien, Verknüpfung nötig |

> **Empfehlung: D1 wo möglich, D2 als Fallback** (so handhabt es auch die Referenz-Lib).

### Entscheidung E — Verhältnis zum bestehenden Ed25519-Modell

> **Empfehlung: additiv.** Beim `append`/Snapshot wird zusätzlich zum internen Custody-Event ein C2PA-Manifest erzeugt und (bei Medien-Assets) eingebettet/als Sidecar abgelegt. Das interne Modell bleibt Single Source des Prüfpfads; C2PA ist der Export-/Interop-Layer. Kein Bruch bestehender Verträge/Tests.

---

## 3. Vorgeschlagener Phasenschnitt (nach Entscheidung)

1. **P3.0 — Gerüst:** Zertifikats-/Key-Handling (B1), Service-Endpoint im Evidence-Runtime, kein Medien-Handling.
2. **P3.1 — Signieren + Einbetten (C1/D1):** JPEG/PNG → C2PA-Manifest via `c2pa-node`, COSE_Sign1, Test-Zertifikat.
3. **P3.2 — Verifizieren:** serverseitig + clientseitig (Web-SDK), Anzeige in `ProvenanceView` („C2PA gültig · Aussteller trusted/untrusted").
4. **P3.3 — PDF (C2), Produktions-Zertifikat (B3):** Betreiberschritt + Doku.

Jede Teilphase: eigener PR, additive Migration falls nötig, Tests, kein Bruch bestehender Routen/Contracts.

---

## 4. Risiken & Nicht-Ziele

- **Nicht-Ziel:** das interne Ed25519-Modell ablösen. Es bleibt.
- **Risiko Trust-List (B):** Ohne B3 ist die Signatur außen „untrusted" — das muss in Marketing/FAQ **ehrlich** stehen (Claims-vs-Runtime-Regel): „C2PA-Manifest erzeugt und kryptografisch prüfbar; öffentlich getrustetes Zertifikat in Vorbereitung."
- **Risiko native Dependency:** `c2pa-node`/`c2patool` sind native Artefakte → Container-Build/CI anpassen; keine Auswirkung auf die Vite-SPA oder Deno-Edge.
- **Verifizierbarkeit der Lib-Details:** exakte Paketnamen, Versionen und Formatlisten sind zum Implementierungszeitpunkt gegen die dann aktuelle `c2pa-rs`/`c2pa-node`-Release zu prüfen (dieses Dokument nennt die Architektur, nicht die pinned Version).

---

## 5. Was ich zur Freigabe brauche

Bitte je Entscheidung ein Kürzel bestätigen (Empfehlung in Fett):

- **A** = Bibliothek/Laufzeit → **A1** / A2 / A3 / A4
- **B** = Zertifikat/Trust → **B1 jetzt, B3 für Produktion** / andere
- **C** = Medien-Scope Start → **C1** / C2 / C3
- **D** = Einbettung → **D1 + D2-Fallback** / nur D2
- **E** = Verhältnis zu Ed25519 → **additiv** / anders

Nach der Bestätigung beginne ich mit **P3.0** (Gerüst + Test-Zertifikat), rein additiv, mit Tests.
