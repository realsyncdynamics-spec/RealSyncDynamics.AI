# Design Intelligence & Guided Integration

**Status**: Spezifikation, nicht umgesetzt
**Verhältnis zum Umbau**: erweitert `docs/product/modular-product-experience.md`;
Bestandsaufnahme in `docs/product/reality-matrix.md`

Zwei Anforderungen, die **Architektur** sind und nicht optionale Oberfläche:

1. Der Frontend-Modernizer ist ein **Design Intelligence Layer** — er leitet
   ein individuelles Design aus Bildern, Screenshots und Beschreibung ab,
   statt aus einer Template-Bibliothek zu wählen.
2. Jede technische Integration hat einen **Setup-Assistenten**. Ein Feld
   `OPENAI_API_KEY: ______` ohne Erklärung ist ein Produktfehler, kein
   fehlendes Komfortmerkmal.

---

## Teil A — Design Intelligence Layer

### A.1 Ist-Zustand (gemessen 2026-08-22)

| Baustein | Zustand | Beleg |
|---|---|---|
| Design-Token-Ebene | **vorhanden** | `packages/siteos-core/src/render/theme.ts`: `sanitizeTheme`, `safeColor`, `safeFontStack`, `safeRadius`, `renderThemeCss` |
| Kontrastprüfung | **vorhanden** | ebd.: `relativeLuminance`, `contrastRatio`, `meetsWcagAA` |
| Blueprint + Render | **vorhanden** | `synthesizeBlueprint`, `renderSite`, `siteos_blueprints` (append-only, prev_hash) |
| Gestaltung | **template-basiert** | `SITE_DESIGN_TEMPLATES` — genau drei feste Richtungen |
| **Bildanalyse** | **fehlt vollständig** | keine Vision-Aufrufe, keine Paletten-Extraktion im gesamten Repository |
| **Asset-Upload für Design** | **fehlt** | einziger Storage-Bucket ist `documents` (Dokumenten-Vault) |
| **Design-Chat / Iteration** | **fehlt** | — |

**Die entscheidende Konsequenz daraus**: `theme.ts` ist bereits eine
typisierte, bereinigte und auf WCAG geprüfte Token-Ebene. Design Intelligence
baut **kein zweites** Token-System daneben, sondern erzeugt genau die
Struktur, die `sanitizeTheme()` entgegennimmt. Alles andere hätte zwei
Wahrheiten über das Aussehen einer Seite — und nur eine davon wäre auf
Kontrast geprüft.

### A.2 Kette

```
USER INPUT ──┬── bestehende URL      → siteos/discover   (vorhanden)
             ├── Fotos               → Asset Intake      (fehlt)
             ├── Logo                → Asset Intake      (fehlt)
             ├── Referenz-Screenshot → Vision Analysis   (fehlt)
             └── Beschreibung        → parseBrief        (vorhanden)
                            │
                            ▼
                  DESIGN INTELLIGENCE
              ┌─────────────┼─────────────┐
          IMAGE         LAYOUT         BRAND
        ANALYSIS       ANALYSIS       ANALYSIS
              └─────────────┼─────────────┘
                            ▼
                  sanitizeTheme()  ← vorhandene Token-Ebene
                            ▼
                  synthesizeBlueprint()  (vorhanden)
                            ▼
                  siteos_blueprints  (versioniert, prev_hash)
                            ▼
                  renderSite()  (vorhanden)
                            ▼
                     PREVIEW  (vorhanden)
                            ▼
                  GOVERNANCE SCAN  (siteos/runtime-scan, vorhanden)
                            ▼
                     EVIDENCE  (evidence_snapshots, vorhanden)
                            ▼
                  PUBLISH GATE  ← FEHLT, steht davor
                            ▼
                      PUBLISH  ← FEHLT
```

Von neun Stufen sind sechs vorhanden. Neu sind Asset Intake, Vision Analysis
und der Publish-Pfad samt Gate.

### A.3 Was abgeleitet wird

Aus Bildern: dominante Farben, Palette, Kontrastverhältnisse, Bildstimmung,
Helligkeitscharakter.
Aus Referenz-Screenshots: Seitenstruktur, Navigationsform, Hero-Aufbau,
Bild-/Text-Verhältnis, Karten- und Containerstil, Radius, Schatten,
Abstandsraster, CTA-Position, visuelle Hierarchie, responsives Verhalten.
Aus Logo: Primär- und Sekundärfarbe, Typografiecharakter.

Ergebnis ist ein **RealSync Design System** je Website: Colors, Typography,
Spacing, Radius, Shadows, Buttons, Cards, Navigation, Hero, Sections, Forms,
Responsive Rules.

### A.4 Verbindliche Regeln

1. **Kein Codekopieren.** Aus einem Referenz-Screenshot wird die *visuelle
   Struktur* abgeleitet und mit RealSync-Komponenten neu implementiert. Weder
   fremdes Markup noch fremdes CSS noch fremde Assets werden übernommen. Ein
   Referenzbild ist eine Richtungsangabe, keine Vorlage zum Nachbauen —
   fremde Marken, Logos und Schutzrechte bleiben aussen vor.
2. **Templates sind Startpunkt, nicht Produkt.** `SITE_DESIGN_TEMPLATES`
   bleibt als Ausgangspunkt bestehen; das Ergebnis ist individuell erzeugt.
3. **Jedes Design läuft durch `sanitizeTheme()`.** Kein Weg am Bereiniger
   vorbei — auch nicht für „vom Kunden ausdrücklich gewünschte" Farben.
4. **Kontrast ist eine Schranke, keine Empfehlung.** Eine aus einem Foto
   abgeleitete Palette, die `meetsWcagAA()` nicht besteht, wird korrigiert und
   die Korrektur wird dem Nutzer benannt. Barrierefreiheit ist zugesagt; ein
   Foto darf sie nicht aushebeln.
5. **Jede Design-Iteration erzeugt eine neue Blueprint-Version.**
   `siteos_blueprints` ist append-only und über `prev_hash` verkettet — der
   Design-Chat schreibt Versionen, er überschreibt nichts.
6. **Generative Herkunft wird korrekt geführt.** `origin.model` benennt das
   tatsächlich beteiligte Modell. Wo deterministisch erzeugt wird, bleibt es
   `null` (Art. 50 EU AI Act — keine KI behaupten, wo keine war; und keine
   verschweigen, wo eine war).
7. **Hochgeladene Bilder sind mandantengebunden.** Eigener Storage-Bucket mit
   RLS, kein gemeinsamer Ablageort, Löschung folgt der Aufbewahrungsregel des
   Tenants.
8. **Governance läuft nach jeder Änderung**, nicht nur vor dem ersten
   Publish: Design Change → Build → Preview → Scan → Risk → Evidence →
   Approval → Publish.

### A.5 Bilder zuordnen

Mehrere Bilder ergeben zusammen ein Design. Die Zuordnung (Hero, Hintergrund,
Produkt, Team, Galerie, Referenz, Social Proof) wird vorgeschlagen und ist
**vom Nutzer überschreibbar**. Eine automatische Zuordnung, die sich nicht
korrigieren lässt, ist schlechter als gar keine.

### A.6 Design-Chat

Iterative Verfeinerung in natürlicher Sprache („mehr Weissraum", „Navigation
kleiner", „Hero-Bild grösser"). Jede Runde: neue Blueprint-Version, neue
Vorschau, kein Überschreiben. Der Nutzer kann zu jeder früheren Version
zurück, weil die Kette sie hält.

---

## Teil B — Guided Integration (API-Key-Assistent)

### B.1 Ist-Zustand (gemessen 2026-08-22)

| Baustein | Zustand | Beleg |
|---|---|---|
| Verschlüsselte Ablage | **vorhanden** | Supabase Vault (`vault.decrypted_secrets`, `app_secret_rpc`), `encrypted_private_key BYTEA` bei VPS |
| Integrations-Registry | **vorhanden** | `integrations` (5), `integration_configs`, `integration_connectors` |
| Marketplace-UI | **vorhanden** | `src/features/integrations/IntegrationMarketplaceView.tsx` |
| Webhook-Konfiguration | **vorhanden** | `WebhookConfigView.tsx` |
| **Geführte Einrichtung** | **fehlt** | keine Anleitung, kein Verbindungstest, kein Zustandsindikator je Integration |

### B.2 Anforderung

Für **jeden** Konfigurationswert — API-Key, Token, Account-ID, Price-ID,
Webhook-URL — muss die Oberfläche fünf Dinge beantworten:

1. **Was** wird gebraucht?
2. **Warum** wird es gebraucht — welche Funktion hängt daran?
3. **Wo** beim Anbieter wird es gefunden oder erzeugt (Schritt für Schritt,
   mit direktem Link)?
4. **Welche Berechtigungen** genau — nicht „ein Token", sondern der konkrete
   Geltungsbereich, so eng wie möglich.
5. **Wie** wird die Verbindung anschliessend geprüft?

Ablauf je Integration: `Nicht verbunden` → Anleitung → Wert einfügen →
**Verbindung testen** → `Aktiv`. Der Test ist Pflicht: eine Integration gilt
erst als verbunden, wenn ein echter Aufruf gegen den Anbieter gelungen ist.

Abzudecken sind mindestens OpenAI, Anthropic, Stripe, Google, Meta/WhatsApp,
Cloudflare, n8n — jeweils mit den tatsächlich benötigten Berechtigungen, nicht
mit einem pauschalen Vollzugriff.

### B.3 Sicherheitsregeln — nicht verhandelbar

```
USER → Secure Settings UI → Backend → verschlüsselter Speicher
                                            ↓
                                   Integration Service → externe API
```

- Geheimnisse werden **serverseitig** entgegengenommen und verschlüsselt
  abgelegt. Der Browser spricht nie direkt mit dem Anbieter.
- Ein einmal gespeicherter Wert wird **nie wieder ausgegeben** — auch nicht
  an den Eigentümer. Anzeige ausschliesslich maskiert (`sk-…4f2a`), Änderung
  nur durch Ersetzen.
- Nichts davon gehört in Client-Bundle, `localStorage`, `VITE_*`-Variablen,
  HTML oder Git. `VITE_*` ist per Definition öffentlich (`CLAUDE.md` §2).
- Kein Service-Role-Key und kein Stripe-Secret im Browser (`CLAUDE.md` §4).
- Jede Anlage, Änderung, Prüfung und Löschung eines Geheimnisses erzeugt
  einen Prüfpfad-Eintrag — **ohne** den Wert selbst.
- Anbieterseitige Fehlermeldungen werden gefiltert weitergegeben; sie
  enthalten regelmässig Teile des gesendeten Schlüssels.

### B.4 Warum das Architektur ist

Ein Kunde, der einen Schlüssel nicht einrichten kann, hat ein Modul gekauft,
das nichts tut. Das verletzt zwei bestehende Regeln zugleich: das
Leitprinzip aus `CLAUDE.md` §14 („Funktionen funktionsfähig machen — kein
Element vortäuschen, das nichts tut") und das Feature Gating aus §20 des
Master-Prompts (`subscription.active && module.enabled` — ein drittes,
unsichtbares Kriterium „und der Kunde hat es irgendwie zum Laufen gebracht"
darf es nicht geben).

---

## Teil C — Backend bleibt unangetastet

```
EXISTING BACKEND (Auth · DB · API · Payments · Governance · Business Logic)
        │
   EXISTING API ── GOVERNANCE API
        │
   FRONTEND API
        │
   SITEOS LAYER
        │
   DESIGN INTELLIGENCE
        │
   NEW FRONTEND
```

Das Frontend darf sich vollständig verändern. Das Backend nicht. Fehlt ein
Endpunkt, wird er **dokumentiert und als fehlende Verbindung markiert** —
nicht durch eine destruktive Änderung ersetzt (§8 des Master-Prompts).

---

## Teil D — Einordnung in die Reihenfolge

Design Intelligence hängt am Publish-Pfad, und der hängt am Publish Gate.
Die Reihenfolge aus `CLAUDE.md` §14 gilt unverändert: **der Publish Gate
steht vor dem ersten SiteOS-Publish-Pfad.**

| Schritt | Inhalt | Vorbedingung |
|---|---|---|
| D1 | Asset Intake: Storage-Bucket mit RLS, Upload, Zuordnung | — |
| D2 | Guided Integration inkl. Verbindungstest | Vault-Ablage vorhanden |
| D3 | Vision Analysis → `sanitizeTheme()`-konforme Tokens | D1 |
| D4 | Design-Chat auf versionierten Blueprints | D3 |
| D5 | **Publish Gate** | — |
| D6 | Publish-Pfad | D5 |

D2 ist bewusst früh: Ohne Anbieter-Schlüssel läuft keine Bildanalyse, und
ohne geführte Einrichtung kommt der Kunde nicht an den Schlüssel.
