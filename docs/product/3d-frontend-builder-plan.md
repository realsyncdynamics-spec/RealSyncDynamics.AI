# 3D Frontend Builder — Produkt- und Umsetzungsplan

**Status:** Vorschlag zur Umsetzung  
**Produktziel:** 3D- und Motion-gestützte Landingpages sollen auch ohne Design- oder Programmierkenntnisse erstellbar sein.

## Produktentscheidung

Der 3D-Modus wird eine geführte Fähigkeit des bestehenden App Builders, kein separater „3D-Baukasten“. Nutzer starten mit einem Geschäftsziel und einer Vorlage, wählen eine visuelle Richtung und erhalten eine editierbare Landingpage. 3D ist ein optionaler, gezielt eingesetzter Teil der Seite; Produkt, Nutzen und Handlungsaufforderung bleiben sofort verständlich.

Erster Anwendungsfall: eine moderne Website für einen Handwerksbetrieb mit klarer Anfrageführung und optionalem KI-Empfang. Governance bleibt die verlässliche technische Kontrollschicht im Hintergrund und wird in der Produktkommunikation nur dort erklärt, wo sie Vertrauen schafft.

## Vorhandene Basis

- `/demo/3d-landingpage` demonstriert bereits eine interaktive Three.js-Szene mit scrollgesteuerter Kamerafahrt, Tastaturbedienung, Touch-Unterstützung, reduzierter Bewegung und einer Alternative ohne 3D.
- `/build` und `BoltWorkbench` bilden den vorhandenen Builder-Einstieg.
- Die aktuelle Vorschau erzeugt HTML/CSS und lokales JavaScript in einer isolierten Sandbox. Sie lädt keine externen CDN-Skripte.
- Die 3D-Erzeugung im Builder ist im Produktstand als geplant markiert.

Diese Grenzen sind Teil der Implementierungsentscheidung: Die neue Vorschau darf nicht auf ein beliebiges externes CDN oder auf uneingeschränkte Ausführung in der Builder-Sandbox angewiesen sein.

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

Der 3D-Renderer muss in die bestehende CSP- und Sandbox-Strategie passen. Kein Preview-Code soll zur Laufzeit beliebige externe Skripte nachladen. Die technische Umsetzung soll zunächst eine lokal gebündelte, versionierte Three.js-Laufzeit und zugelassene GLB-Assets im vorhandenen Preview-Pfad nachweisen. Falls die jetzige Sandbox das nicht sicher unterstützt, ist ein eng begrenzter Renderer-Endpunkt mit expliziter Asset-Freigabe zu entwerfen, bevor die Funktion als verfügbar angezeigt wird.

Motion wird als kleine, geprüfte Menge an Übergängen und Interaktionen modelliert. Für React-basierte Ausgaben kann Motion for React genutzt werden, sofern der tatsächliche Builder-Renderpfad React unterstützt; die aktuelle HTML-Ausgabe darf nicht stillschweigend davon abhängig gemacht werden.

### 5. KI und Sicherheit

- Modellanbieter werden über die bereits vorhandene Gateway-/Provider-Schicht angesprochen; Anbieterwahl ist von der 3D-Runtime getrennt.
- Tenant-Nutzer erhalten keinen direkten Zugriff auf Claude-Code-CLI, Blender-Python oder ein allgemeines MCP-Werkzeug.
- Keine freie Codeausführung durch importierte Szenen. Uploads, Manifest, Assetgröße und Dateitypen werden serverseitig geprüft.
- Speichern, Vorschau, Export und Veröffentlichung sind getrennte Aktionen. Der Builder zeigt klar an, was nur Vorschau ist.
- Tenant-Isolation, bestehende Authentifizierung, Inhaltsrichtlinien und Audit-Evidenz bleiben erhalten.

## Gestufte Umsetzung

### Phase 0 — Laufzeitnachweis

Ein vorhandenes Demo-Modell über den echten Builder-Projekt- und Preview-Pfad laden. CSP, Sandbox, Mobilgerät, Ladezeit, WebGL-Ausfall und Reduced Motion prüfen. Ergebnis ist eine technische Entscheidung mit gemessenen Grenzen; noch keine öffentliche Produktzusage.

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

## Offene technische Entscheidung

Vor Phase 1 ist im echten Builder zu entscheiden, ob ein lokal gebündelter Three.js-Renderer innerhalb des vorhandenen Preview-Iframes zulässig und praktikabel ist. Falls nicht, muss ein isolierter Renderer mit enger Nachrichten- und Asset-Schnittstelle gebaut werden. Diese Entscheidung darf nicht durch externe CDN-Skripte oder das Abschalten der CSP umgangen werden.
