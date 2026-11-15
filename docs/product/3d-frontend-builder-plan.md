# 3D Frontend Builder — Produkt- und Umsetzungsplan

**Status:** Umsetzungsvorschlag, technische Bestandsaufnahme ergänzt am 15.11.2026  
**Produktziel:** 3D- und Motion-gestützte Landingpages sollen auch ohne Design- oder Programmierkenntnisse erstellbar sein.

## Produktentscheidung

Der 3D-Modus wird eine geführte Fähigkeit des bestehenden App Builders, kein separater „3D-Baukasten“. Nutzer starten mit einem Geschäftsziel und einer Vorlage, wählen eine visuelle Richtung und erhalten eine editierbare Landingpage. 3D ist ein optionaler, gezielt eingesetzter Teil der Seite; Produkt, Nutzen und Handlungsaufforderung bleiben sofort verständlich.

Erster Anwendungsfall: eine moderne Website für einen Handwerksbetrieb mit klarer Anfrageführung und optionalem KI-Empfang. Governance bleibt die verlässliche technische Kontrollschicht im Hintergrund und wird in der Produktkommunikation nur dort erklärt, wo sie Vertrauen schafft.

## Vorhandene Basis

- `/demo/3d-landingpage` demonstriert bereits eine interaktive Three.js-Szene mit scrollgesteuerter Kamerafahrt, Tastaturbedienung, Touch-Unterstützung, reduzierter Bewegung und einer Alternative ohne 3D.
- `/build` und `BoltWorkbench` bilden den vorhandenen Builder-Einstieg.
- Die Anwendung hat bereits `three`, `@react-three/fiber` und `@react-three/drei` als Abhängigkeiten.
- Die Builder-Vorschau erzeugt HTML/CSS und lokales JavaScript in einem `srcDoc`-Iframe. Die CSP sperrt Netzwerkzugriffe und externe Skripte; interaktives JavaScript läuft in opaker Herkunft ohne `allow-same-origin`.
- Die 3D-Erzeugung im Builder ist im Produktstand als geplant markiert.

Die bestehende Demo beweist, dass eine 3D-Szene im vertrauenswürdigen React-Frontend läuft. Sie beweist noch nicht, dass sie im HTML-Preview-Sandboxpfad läuft.

## Nutzerablauf

1. **Ziel:** Nutzer beschreibt Betrieb, Zielgruppe und gewünschte Aktion.
2. **Inhalt:** Nutzer ergänzt Angebot, Kontaktweg, Bilder und vorhandene Texte.
3. **Look & Feel:** Nutzer wählt eine Designrichtung, zum Beispiel „präzise Architektur“, „warme Handwerksmaterialien“ oder „ruhige Produktinszenierung“.
4. **Bewegung:** Nutzer wählt eine von drei verständlichen Stufen: statisch, Motion oder Motion + 3D. Die Oberfläche erklärt kurz den Effekt und weist auf Ladegewicht hin.
5. **Vorschau:** Desktop- und Mobilvorschau mit Umschalter „3D / leicht“ und sofort sichtbarer Reduced-Motion-Variante.
6. **Anpassen:** Nutzer kann Text, Farben, Abstände und Szenenparameter über geführte Regler und natürliche Sprache ändern; jedes Ergebnis bleibt editierbar.
7. **Entwurf sichern:** Zusammenfassung zeigt Seitenabschnitte, Assets, verwendete Motion-Stufe, offene Inhalte und Vorschau-Status. Veröffentlichung bleibt ein eigener, expliziter Schritt.

## Architektur

### 1. Seitenstruktur bleibt editierbar

Der Builder behält seine bestehende HTML/CSS-Ausgabe als Grundlage. Seitenabschnitte und deren Inhalte bleiben editierbare Projektdaten. 3D wird als klar abgegrenzter Szenenblock mit versioniertem Szenenmanifest ergänzt, statt die gesamte Seite in eine undurchsichtige Canvas zu verwandeln.

### 2. Szenenmanifest statt freier Laufzeitcode

Ein validiertes Manifest beschreibt erlaubte Szenenelemente und Parameter, zum Beispiel Modellreferenz, Beleuchtungspreset, Kamera, Hotspots, Drehung und Motion-Intensität. Der Renderer akzeptiert nur bekannte Komponenten und begrenzte Werte. KI-Ausgaben werden gegen dieses Schema geprüft; ungültige Ergebnisse fallen auf eine statische Produktansicht zurück.

### 3. Asset-Pipeline

- **Blender** dient der professionellen Erstellung und Optimierung von Modellen und Animationen.
- Exportformat ist GLB/glTF; Assets werden geprüft, komprimiert, mit Größenlimit versehen und tenantbezogen gespeichert.
- **Spline** kann später als optionale Einsteigeroberfläche für Szenen dienen, sofern Authentifizierung, Rechte, Exportqualität und Mandantentrennung geklärt sind. Es ist keine Laufzeitabhängigkeit des Builders.
- **Higgsfield** ist optional für Bild- und Videomaterial. Es ersetzt weder Blender noch den interaktiven 3D-Renderer.

### 4. Vorschau-Laufzeit

Der 3D-Renderer darf keine externen Skripte nachladen und keinen vom Nutzer oder Modell erzeugten JavaScript-Code mit erweiterten Rechten ausführen.

**Technische Bestandsaufnahme:** Der bestehende `srcDoc`-Preview kann nur HTML/CSS und inline JavaScript darstellen. Seine CSP setzt `default-src 'none'`, sperrt `connect-src` und externe Skripte. Die vorhandene Three.js-Abhängigkeit ist im Vite-Hauptbundle verfügbar, nicht als importierbares Modul im isolierten HTML-Dokument. Deshalb ist ein direktes Einbetten der vorhandenen React-3D-Demo in diesen Iframe nicht möglich, ohne die Isolierung zu lockern oder ein großes Bundle in den Entwurf einzubetten.

**Architekturentscheidung für den Laufzeitnachweis:** 3D bleibt ein vertrauenswürdiger, gebündelter React-Renderer im Hauptfrontend. Der Builder liefert ihm ausschließlich ein schema-validiertes Szenenmanifest und freigegebene Asset-IDs. Er rendert keine KI-generierten Skripte. Das Manifest wird über eine eng definierte Nachrichten-Schnittstelle an den Renderer übergeben; die bestehende HTML-Vorschau bleibt separat und isoliert. Damit bleiben HTML-Entwurf und 3D-Szene editierbare, getrennte Bestandteile.

Motion wird als kleine, geprüfte Menge an Übergängen und Interaktionen modelliert. Motion for React ist für React-basierte Oberflächen verfügbar; die aktuelle HTML/CSS-Ausgabe darf nicht stillschweigend von dieser Laufzeit abhängen.

### 5. KI und Sicherheit

- Modellanbieter werden über die bereits vorhandene Gateway-/Provider-Schicht angesprochen; Anbieterwahl ist von der 3D-Runtime getrennt.
- Tenant-Nutzer erhalten keinen direkten Zugriff auf Claude-Code-CLI, Blender-Python oder ein allgemeines MCP-Werkzeug.
- Keine freie Codeausführung durch importierte Szenen. Uploads, Manifest, Assetgröße und Dateitypen werden serverseitig geprüft.
- Speichern, Vorschau, Export und Veröffentlichung sind getrennte Aktionen. Der Builder zeigt klar an, was nur Vorschau ist.
- Tenant-Isolation, bestehende Authentifizierung, Inhaltsrichtlinien und Audit-Evidenz bleiben erhalten.

## Gestufte Umsetzung

### Phase 0 — Laufzeitnachweis

**Quellcodeprüfung abgeschlossen:** Dependencies, bestehende Demo, Iframe-Sandbox und CSP sind abgeglichen. Die Demo und Three.js laufen im App-Frontend; die existierende HTML-Sandbox kann sie nicht direkt laden. Empfohlener Pfad ist deshalb der gebündelte React-Renderer mit schema-validiertem Manifest als Daten, nicht Code.

Als nächster ausführbarer Schritt ist ein minimaler End-to-End-Prototyp nötig: Builder-Regler ändern ein kleines Szenenmanifest; der getrennte React-Renderer zeigt die Szene in der Builder-Preview; Umschalter „3D / leicht“, Reduced Motion, Tastatur und WebGL-Fallback funktionieren. Erst danach sind echte Geräte-, Performance- und CSP-Messungen möglich. Bis dahin gilt 3D-Generierung weiterhin als geplant.

### Phase 1 — Geführter 3D-Modus

Ein 3D-fähiges Landingpage-Template für Handwerksbetriebe ergänzen. Nutzer können eine geprüfte Szene auswählen, Produkt-/Betriebsdetails ändern, Motion-Stufe umschalten und eine leichte Fallback-Version ansehen. Entwurf bleibt speicherbar und editierbar.

### Phase 2 — Asset-Import

GLB-Upload mit Validierung, Vorschau, Größen-/Performancehinweisen und Lizenz-/Herkunftsangabe. Blender bleibt der verlässliche Authoring- und Exportweg. Spline-Import erst nach positivem Auth-, Rechte- und Mandantentrennungstest.

### Phase 3 — KI-gestützte Szenenänderung

KI erzeugt ausschließlich Manifeständerungen aus einer begrenzten Komponentenbibliothek, etwa „Kamera näher“, „Licht wärmer“ oder „Hotspot am Eingang“. Nutzer sieht Änderungen als Vorschau, kann sie zurücknehmen und behält die Kontrolle über einzelne Änderungen.

### Phase 4 — Produktisierung

Nutzungsgrenzen, Asset-Speicher, Generierungskosten, Exportrechte und Tarifzuordnung auf Basis realer Messwerte definieren. Erst dann Preise und Verfügbarkeitsclaims festlegen.

## Abnahmekriterien

- Ein Nutzer ohne Codekenntnisse erstellt aus Ziel, Inhalt und Stil einen vollständigen, editierbaren Entwurf.
- Ein einfacher Entwurf funktioniert auch ohne 3D; 3D ist wählbar und abschaltbar.
- Der Szenenblock wird aus einem validierten Manifest gerendert, nicht aus frei generiertem Laufzeitcode.
- Mobil-, Tastatur-, Reduced-Motion- und WebGL-Fallbacks sind vorhanden.
- Vorschau, Speicherung, Export und Veröffentlichung sind klar getrennte Zustände.
- Keine externen CDN-Abhängigkeiten oder unbeschränkten MCP-/CLI-Werkzeuge für Tenant-Nutzer.
- Performancebudgets für initiale Seitenlast und 3D-Assetgröße werden vor Produktfreigabe festgelegt und im Preview sichtbar gemacht.
- Status- und Verfügbarkeitsangaben spiegeln die Implementierung wider; ungebaute Funktionen bleiben als geplant markiert.

## Nächster konkreter Umsetzungsschritt

Im bestehenden PR ist der Architekturpfad festgelegt; die Builder-Funktion selbst ist noch nicht implementiert. Der Prototyp sollte auf einem eigenen Feature-Branch folgen, sobald die Laufzeit-Schnittstelle und der manifestierte Scene-Renderer konkret umgesetzt werden. Keine externe Veröffentlichung und kein Merge ohne Freigabe.
