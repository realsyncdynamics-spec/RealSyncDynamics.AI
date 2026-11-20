# SYNC – Masterfilm und wiederverwendbares RealSync-Mediensystem

**Stand:** 20.11.2026 · **Status:** Produktionsvorlage; kein fertiges Video und keine bestätigte Live-Telefonie.

## 1. Markenentscheidung

SYNC ist **eine feste 3D-Markenfigur**. Ein Modell, eine Identität, ein Gesicht, ein Materialsystem, definierte deutsche Stimme und wiedererkennbare Bewegungen. Produktwechsel verändern nur die Pose, Interaktionssymbole und Bühnenobjekte – niemals die Grundfigur.

**Modellquelle:** [PR #2338](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2338) enthält den ersten GLB-Export (noch nicht auf main). [PR #2340](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2340) integriert ihn als Hero (noch nicht gemergt). Wir erzeugen **keinen zweiten Bot**.

**Sechs weiße Produktseiten:** [Draft #2350](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2350) enthält eine separate Produktfamilie mit optionalem Higgsfield-Video. Ein echter Higgsfield-Export ist dort noch nicht hinterlegt. Die Änderungen überschneiden sich an Startseite, Router und SEO: Erst in einem Integrations-PR konsolidieren, dann nach separater Freigabe mergen.

**Design:** weiß, dunkle Schrift, Security-Blue, silberne Details, ruhige Mikroanimationen. Keine Menschen-Avatare als Ersatz für SYNC.

## 2. Der 90-Sekunden-Film

Die einzige editierbare Zeitquelle ist [storyboard.json](./storyboard.json). Sechs Szenen, 15 Untertitel-Cues, Quellbelege je Szene.

| Zeit | Inhalt | Freigabeanforderung |
|---|---|---|
| 00–12 s | SYNC begrüßt | Abgenommenes Mastermodell |
| 12–30 s | Deutscher Beispieldialog | Als Demo markieren, sofern kein realer E2E-Nachweis |
| 30–48 s | Anfrage und Übergabe im Backend | Tatsächlicher, anonymisierter UI-Ablauf oder Konzept-Overlay |
| 48–65 s | Website-Scan, Ergebnis, nächste Schritte | Autorisierter Screencast; keine erfundenen Scores |
| 65–80 s | Governance und sechs Produkte | Nur belegte Funktionen als verfügbar ausgeben |
| 80–90 s | SYNC + Logo/Domain | Markenrechte und Sprache prüfen |

**Dialogstatus:** Das Kundengespräch im Skript ist fiktiv. Eine echte deutsche Voice-Agent-Demonstration braucht einen vollständig getesteten Kanal, Datenschutzprüfung, verifizierte Transkript-/Ereignisprotokolle und den nachgewiesenen Handoff an einen Menschen. [PR #2331](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2331) enthält einen animierten Voice-Bot, jedoch laut PR keine angebundene Sprach-API.

## 3. Dachmarke und Produktziele

Alle Seiten sollen dasselbe weiße Gestaltungssystem, denselben Footer, dieselbe Navigation und dieselbe SYNC-Figur nutzen. Jeweils ein anderer Hero-Ablauf. Zielpfade, **nicht als bereits live bestätigt**:

| Produkt | Zielroute | Hero-Motiv |
|---|---|---|
| Governance OS | /governance-os | Audit, Evidence, Freigaben |
| Voice Agent | /voice-agent | Zuhören, Sprechen, Übergabe |
| App Builder | /app-builder | Idee → Vorschau |
| Software Factory | /software-factory | Auftrag → Code-Diff → Review |
| Automation OS | /automation-os | Workflow → Policy → Entscheidung |
| Creative Studio | /creative-studio | Asset → Bearbeitung → Export |

Kundenweg: Startseite → Produkt. Für eine Website: Scan → Ergebnis → optional neues Frontend (bestehendes Backend nur beibehalten, wenn verifiziert) → optional Voice/WhatsApp → Governance. Jede nicht aktivierte Funktion bleibt eindeutig als Preview gekennzeichnet.

## 4. Benötigte Medien

1. Abgenommenes SYNC-Mastermodell (GLB), Rig-/Animationsübersicht, finale Materialpalette und transparente bzw. weiße Render-Pässe.
2. Freigegebene Logo-Datei; Rechte an Modell, Soundtrack, Sprecher- und Drittmaterial.
3. Deutsche Voice-Spuren und bei tatsächlichen Anrufen notwendige Nutzungs-/Aufzeichnungseinwilligungen.
4. Anonymisierte Bildschirmaufnahmen aus echten Scan-, Ergebnis-, Handoff- und Governance-Sessions.
5. Prüfung des jeweiligen Produktstatus gegen die aktuelle Implementierungs-Registry und funktionsfähige Runtime.

Werkzeuge: vorhandenes Three.js/GLB für wiederholbare Animation, Blender/3D-Renderer für Filmshots, Higgsfield optional für ergänzende Bilder **ohne Charakter-Reinterpretation**, OBS/Playwright für verifizierbare Captures und Videoeditor/FFmpeg für Schnitt. Keine weitere Lizenz ist Voraussetzung.

Export-Ziel: 1920×1080, 30 fps, 48 kHz, 16:9. Social-Version 9:16 neu komponieren, nicht UI unkontrolliert abschneiden. Im Browser müssen reduzierte Bewegung, schwache Geräte und Datensparmodus berücksichtigt bleiben.

## 5. Produktionsdateien automatisch vorbereiten

Nur Node-Bordmittel, keine zusätzlichen Pakete oder externen API-Anrufe:

    node scripts/generate-sync-storyboard.mjs --check
    node scripts/generate-sync-storyboard.mjs --out /tmp/sync-media

Erzeugt drei übertragbare Dateien:

- **SYNC_Master_90s.vtt:** 15 zeitlich verankerte kurze Untertitel. Keine wortgetreue Transkription des gesprochenen Dialogs.
- **SYNC_Shotlist.csv:** Filmszenen, Timing, benötigte Bilder und Prüfnachweise.
- **SYNC_VoiceScript.md:** vollständiger deutscher Sprechertext mit getrennten Rollen.

Der Generator erstellt **kein MP4, keine Aufnahme, keinen fertigen 3D-Render und keine produktive Voice-Integration**.

## 6. Veröffentlichungsgates

- [ ] Gleiches SYNC-Modell in Hero, Produktseiten und Film; keine neue Figur pro Szene.
- [ ] Rechte, Datenschutz, Sprecher und Aufnahmebedingungen geklärt.
- [ ] Deutscher Voice-E2E-Test nachgewiesen **oder** Demo-Kennzeichnung sichtbar.
- [ ] Echte Backend-/UI-Belege der gezeigten Abläufe vorhanden **oder** Konzept-Kennzeichnung.
- [ ] Live / Implementiert / Preview aus aktueller Implementierungs-Registry übernommen.
- [ ] Mobilgerät, Leistung, Fallback und reduzierte Bewegung getestet.
- [ ] Untertitel mit Ton und Bild manuell abgeglichen.
- [ ] Konsolidierte Landingpage-PRs CI-geprüft.
- [ ] Explizite Merge- und Cloudflare-Deploy-Freigabe eingeholt.

## 7. Umfang

Dieses Arbeitspaket verändert **nicht** Startseite, Router, Voice-Backend, Auth, RLS, Pricing, Produktion oder main. Es liefert ein versioniertes, prüfbares Drehbuch und Medienübergabe. Die konkurrierenden PRs #2331, #2338, #2340, #2344 und #2350 wurden nicht gemergt oder verändert.
