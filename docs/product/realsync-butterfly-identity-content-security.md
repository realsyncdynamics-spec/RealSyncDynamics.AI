# RealSync Butterfly – Digital Twin Identity & Content Protection
Stand 20.11.2026 · Designentscheidung / Draft · Erweiterung von PR #2382.
Nicht öffentlich als fertige Verifizierung vermarkten. Kein Merge/Deploy/Schema-Change erfolgt.

## Produktversprechen, präzise
- Digital Twin: Person -> zulässige Identitätsprüfung und Avatar-Ermächtigung -> eindeutige Avatar-Referenz.
- Jeder veröffentlichte Avatar kann ein öffentliches Profil und einen QR zum spezifischen Avatar-Nachweis haben.
- Jeder registrierte Inhalt (Foto, Video, Audio, Grafik) kann separat kryptografisch nachgewiesen und der Avatar-ID zugeordnet werden.
- Die Profilseite informiert über freigegebene Personendaten, Projekte, Content, Kontaktlinks, Lizenzangaben und überprüfbare Status.
- Butterfly ist die Brücke zwischen Offline-Auftritt (gescannter QR) und online verifizierbarem digitalen Repräsentanten.
- Ein QR, Wasserzeichen, SHA-256-Hash oder Signatur beweist **nicht automatisch** rechtliche Urheberschaft oder uneingeschränkte Nutzungsrechte. Es belegt unter definierten Vertrauensannahmen Zuordnung, Integrität, Herausgeber und Dokumentation.

## Sicherheitsprinzip: fünf getrennte Schichten
1. **Identität**: Account-Login allein ist kein Realwelt-Identitätsnachweis. Für Badge "Identität geprüft" braucht es ggf. IDV + Liveness + dokumentierte Bindung zwischen Person, Account und Avatar (separate Einwilligung). Datenminimierung; nicht ungefragt Gesichtserkennungsdaten aufbewahren.
2. **Private Daten**: Medien und Ausweisnachweise getrennt; tenant-isolierter Storage, Transportverschlüsselung, Verschlüsselung at rest, KMS/HSM-gebundene Schlüssel, wenig öffentliche Metadaten. **Verschlüsselung hält Kopien im öffentlichen Netz nicht auf.**
3. **Inhaltsintegrität**: exakte Medien-Bytes mit SHA-256; signiertes Provenance-/C2PA-Manifest; issuer/key_id, trusted key history, timestamp, asset_id, avatar_id, subject authorization, optional Lizenzstatus, Widerruf.
4. **Wiederauffindbarkeit**: unsichtbares robustes Wasserzeichen mit zufälligem, nicht rückrechenbarem Asset-Token, plus perceptual fingerprint/soft binding (nicht mit SHA-256 verwechseln). Bei Neukodierung kann Metadata fehlen; Soft Binding kann schwächer und fehlbar sein.
5. **Öffentliche Verifikation**: sichtbarer QR verweist nur auf ein öffentliches HTTPS-Proof-Ziel ohne Secrets oder personenbezogene Rohdaten. Verifier prüft Signatur **gegen vertrauenswürdige öffentliche Schlüssel**, Identitäts-/Assetbindung, Hash der vorgelegten Datei, Status/Revocation und ggf. zeitliche Grenzen. Treffer auf einem Profil-URL allein zählt nicht als verifizierter Content.

## URL-Modell, vorgeschlagen – ausdrücklich noch NICHT vorhanden
- /butterfly/u/:publicHandle – öffentliche persönliche Landingpage (Alias, Kurzbeschreibung, Links, freigegebene Werke, "Avatar KI-generiert", Nachweise). Private Editor-Ansicht nur mit Login.
- /butterfly/avatar/:opaqueAvatarId – Avatar-Verifizierungsnachweis (spezifische Instanz), QR am Avatar. Weiterleitung/Verknüpfung zur Personenseite.
- /butterfly/proof/:opaqueAssetId – asset-spezifischer Content-Nachweis (spezifische signierte Datei/Version), QR pro Werk.
- /butterfly/verify – optional Upload zum Berechnen des Hashes im Browser; keine Rohdatei ohne Freigabe an den Server senden.
Unvorhersagbare IDs, HTTPS, keine E-Mail, Klarnamen, JWT oder signierten Secrets im QR-String. URLs bleiben grundsätzlich kopierbar.

## Zustandsmaschine für öffentliche Anzeige
- UNVERIFIED: fehlender Prüfschritt, nur Account, fehlende Identitätsbindung, fremder/fehlender Vertrauensanker, fehlende Prüfdaten.
- VERIFIED: nachweislich verifizierte Person und Avatarfreigabe + passende Datei + gültige Signatur über vertrauenswürdigen Schlüssel + gültiger Consent-/Revocation-Status.
- MISMATCH: ungültige Signatur oder Datei-Hash-Abweichung nach echter Byteprüfung; nicht als "Diebstahl bewiesen" bezeichnen.
- REVOKED: Ermächtigung, Signaturschlüssel oder Nachweis widerrufen.
- NOT_FOUND/EXPIRED: technisch differenzierte UI-Zustände ergänzen, keine positive Bestätigung.
Wichtig: Browser-Boolean-Flags sind nicht vertrauenswürdig. Der Implementierungshelper butterflyVerdict.ts bildet nur bereits vertrauenswürdig geprüfte Attestierungsdaten in Display-Labels um. Alle Sicherheitsentscheidungen liegen im Server-Verifier.

## Pipeline für einzelne Werke (Ziel)
1. Benutzer/Person geprüft + Einwilligung widerrufbar dokumentiert.
2. Asset in privatem Store angelegt; tenantId, Avatar-Referenz, Rechtebasis, Consent-Snapshot, requested license metadata.
3. Finalen Export erzeugen; falls sichtbar QR oder Wasserzeichen eingebettet wird, anschließend **finale** Ausgabebytes signieren/verknüpfen. C2PA-Binding erfordert standardkonforme Einbettung ohne zirkuläre Hash-Abhängigkeiten – von C2PA SDK lösen lassen, nicht per Hand beliebig Hashen.
4. KMS/HSM-gestützte, vertrauenswürdige Signatur ausstellen; C2PA Builder/Verifier prüfen (COSE, X.509, JUMBF; reale SDK-Tests). Zusätzlich bestehende Ed25519-Custody-Kette referenzieren, aber nicht als C2PA-Zertifizierung ausgeben.
5. Proof-Record, key_id, signer details und Zeitsiegel speichern; optional externes vertrauenswürdiges Zeitstempel-/Anchor-System.
6. QR / Public-Profil-Site nur nach erfolgreichem Proof-Record freigeben. Unverifizierte, gelöschte, widerrufene Werke dürfen nie grünen Status erhalten.
7. QR auf Avatar soll Avatar nachweisen; QR auf Content soll **spezifischen Content** nachweisen; beide verlinken zur Profilseite.
8. Separate maschinenlesbare KI-Kennzeichnung und notwendige Offenlegung im Content und auf Public-Site.

## Vorhandene RealSync-Komponenten – Fundstellen im Repo
- src/lib/provenance/canonicalClaim.ts -> sha256Hex, canonical claim.
- src/lib/provenance/signature.ts -> Ed25519 Signaturprüfer; dieser wurde nicht neu erfunden.
- src/lib/provenance/verifyBundle.ts -> Offlineprüfung; ACHTUNG: ein mitgelieferter öffentlicher Schlüssel beweist ohne unabhängigen Vertrauensanker nicht, *wem* der Signierer gehört.
- src/lib/provenance/c2paManifest.ts -> deklarative C2PA-Vorbereitung. Datei benennt explizit fehlende COSE_Sign1/JUMBF/X.509-Einbettung.
- supabase/functions/c2pa-manifest-generate/index.ts -> Manifest-ähnliches JSON für bestimmte Governance-Reports; nicht gleichsetzen mit interoperablen, standardkonformen Content Credentials.
- supabase/functions/provenance/index.ts -> vorhandener signierter Custody-/Registerpfad, Auth/Entitlements und Live-Verfügbarkeit vor Anbindung erneut prüfen.
- src/features/assets/AssetDetailModal.tsx -> QRCodeSVG vorhanden, derzeit aber Mock-Hash und HARDCODIERTE Labels C2PA_VERIFIED, WATERMARK ACTIVE, VERIFIED_BY_REALSYNC_DYNAMICS. Diese UI ist **KEIN** verlässlicher Proof und muss vor öffentlicher Anzeige auf echte Verifier-Resultate umgestellt werden.
- src/core/billing/types.ts, src/core/billing/entitlements.ts, shared/pricing.ts -> bereits bekannte keys asset.register, asset.verify, watermark.apply, barcode.issue, c2pa.export. Entitlement-Parität/Provisionierung prüfen; älterer Audit vermerkte nicht erreichbare Keys in der verkauften Tarifleiste.
- docs/product/implementation-status.md -> keine pauschalen Live-Claims.
- documents/AUDIT: AUDIT/04_EVIDENCE_CRYPTO.md warnt vor fehlendem externen Trust-Anchor und unvollständigen Key-Rotationsnachweisen; damaliger Produktionsstatus ist als historischer Befund zu behandeln.

## Privatsphäre
Die gewünschte "persönliche private Landingpage" braucht zwei Sichten:
- Öffentliche QR-Landingpage: Alias, freiwillige Biografie, öffentlich freigegebene Projekte, Nachweisstatus, Kontakt nach Freigabe. Keine Identitätsdokumente/Adressen.
- Privates Butterfly-Dashboard: Verifizierung, Rechte-/Einwilligungsdokumente, Contentverwaltung, Auditlog, Sperren, Löschen, Missbrauchsmeldungen.
Bei abweichenden Rollen Besitzer, Herausgeber, Urheber, Lizenzgeber, abgebildete Person dürfen diese nicht gleichgesetzt werden.

## Angriffsmodell / Limitierungen
- Jemand kann sichtbaren QR auf fremdes Bild kleben: ohne Medienhash führt dies **nicht** zu erfolgreicher Contentverifikation.
- Jemand kann das Bild kopieren und dessen gültigen Nachweis mitkopieren: Verifikation zeigt, **woher** der Inhalt stammt, verhindert aber keine unbefugte Kopie. Gegen Missbrauch braucht es Meldewege/Takedown und gegebenenfalls Rechtsdurchsetzung.
- Jemand entfernt C2PA-Metadaten: Soft-Bindings/Fingerprints können Manifest wiederfinden, aber nicht garantiert; Wasserzeichen können bei Bearbeitung verloren gehen.
- Man kann eine Person fälschlich als sein eigenes Profil anmelden: ID/Face-Bindung und dokumentierte Zustimmung + Claim-Review vor "Identität geprüft".
- QR-Betreiber/Domain kompromittiert: unabhängige Signaturprüfung, Pinned Trust-Anchor und C2PA-Verifier ermöglichen Gegenprüfung; nur HTTPS zum vermeintlichen Profil reicht nicht.
- Markierungsverfahren und Signatur-Keys dienen verschiedenen Zwecken; sie sind nicht austauschbar.
- Keine automatische rechtliche Exklusivität für KI-erzeugte Bilder; Rechts- und Lizenzlage je Asset gesondert erfassen.

## Relevante Spezifikationen und Recht
- C2PA: https://spec.c2pa.org/specifications/specifications/2.5/specs/ContentCredentials.html
- C2PA Soft Binding Guidance: https://spec.c2pa.org/specifications/specifications/2.4/guidance/Guidance.html
- CAWG Identity Assertion: https://cawg.io/identity/
- W3C Verifiable Credentials v2: https://www.w3.org/TR/vc-data-model/
- EU AI Act Art. 50: https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng

## Umsetzung in PR #2382
- Erweitert lokale Foto-Vorschau um echten SHA-256-Fingerabdruck unter Verwendung des vorhandenen RealSync-Provenance-Helpers.
- UI zeigt verpflichtend "Nicht überprüft", "Nicht ausgestellt", QR nicht verfügbar, Wasserzeichen nicht integriert.
- Neue Pure-Presentation-Policy butterflyVerdict.ts samt Tests für fail-closed Status; noch keine tatsächliche Person-/Content-Verifikation.
- Bestehendes Login, TenantProvider, UI Shell unverändert.
- Kein neuer Dienst, keine Datenbank-Migration, kein Public Profile Launch, kein Aufruf kostenpflichtiger APIs.

## Abnahme vor echter Freigabe
- CI TypeScript, UI und Tests auf aktuellem PR-Head; Produktstatus/Claims überprüfen.
- Vor echtem Identity-Badge: IDV/Liveness/Consent, Vertrauensregister, Key-Rotation und Widerruf implementieren.
- Vor echtem Content-Badge: C2PA-Konformität und unabhängige Validierung, exact-byte-Hash-Abgleich, QR-rebinding-Angriffe, Wasserzeichen-Robustheit und Falschpositivtests.
- Privacy by design / AVV / Speicherfristen / Auftragsverarbeiter / DSFA-Relevanz prüfen; keine pauschale DSGVO-Konformitätszusage.
- AssetDetailModal-Mock-Claims und ggf. öffentlicher /verify/-Pfad separat absichern. Bis dahin niemals "Verified" aus einem QR oder frei eingetragenen Hash ableiten.
- Kein Merge, Deploy, neue Keys, neue Entitlements oder Kosten ohne gesonderte Freigabe.
