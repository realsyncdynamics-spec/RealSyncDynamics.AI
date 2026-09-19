# Handoff: RealSync Dynamics AI — Web + Mobile Prototyp

## Overview
Klickbarer Prototyp der Produkt-Oberfläche von RealSync Dynamics AI (Runtime-Governance für regulierte KI-Systeme, EU AI Act / DSGVO). Zehn Screens, ein geteilter Zustand für Web (1280×820) und Mobile (390×844). Zielgruppe: Geschäftsführung (Übersicht), Sprache Deutsch mit EN-Toggle.

Ziel-Repo: `realsyncdynamics-spec/RealSyncDynamics.AI` (main). Stack laut Repo: React + TypeScript (Vite), Supabase EU, Tailwind. Routen laut `App.tsx`: `/`, `/login`, `/audit`, `/pricing`, `/app/dashboard`, `/app/ai-systems`, `/app/ai-systems/:id`, `/app/policy-packs`, `/app/evidence`, `/app/reports`.

**Achtung vs. PR #1467 (Titan-Hero):** Dieser Entwurf nutzt Cyan-Akzent (kein Gold), deutsche Copy mit EN-Toggle, zwei Hero-CTAs (`audit-cta` + „Live Dashboard ansehen“) — damit bleibt `canonical-scan-entry.test.tsx` gültig. Bitte diesen Stand als Referenz nehmen, nicht die Gold-Variante.

## About the Design Files
`RealSync Dynamics AI.dc.html` ist eine **Design-Referenz in HTML** (Prototyp), kein Produktionscode. Aufgabe: im bestehenden React/TS-Stack nachbauen — mit den vorhandenen Komponenten (`src/components/governance-os/*`, `MobileBottomNavigation.tsx`), der Preis-SSoT (`shared/pricing.ts`, `tierById`) und `shared/enforcement-classes.ts`. Werte unten sind exakt und verbindlich (hifi).

## Fidelity
**High-fidelity.** Farben, Typo, Abstände, Radien und Zustände sind final. Pixel-genau nachbauen; Copy 1:1 übernehmen (DE), EN-Strings liegen in der Logik-Klasse (`T.en`).

## Screens / Views

### 1 Landing `/`
- Hintergrund `#02050B`. Europa-Karte (`assets/europe-map-v2.png`) rechts, perspektivisch: `transform: rotateY(-14deg) rotateX(6deg) scale(1.06)`, `perspective:1400px`, Origin `70% 50%`, `filter: saturate(1.15) contrast(1.08)`. Darunter dieselbe Karte als Tiefenebene: `scale(1.10) translateZ(-120px)`, `blur(14px) brightness(.55)`, `opacity .55`, `mix-blend-mode:screen`. Overlays: radialer Blau-Glow `rgba(30,90,255,.18)` bei 78%/55%; horizontaler Verlauf `#02050B 0–34% → transparent 68%`; vertikale Vignette oben/unten; Dot-Grid 32px `rgba(255,255,255,.035)` links (maskiert).
- Nav (Padding 26px 48px): Logo „RealSync Dynamics.AI“ (Inter Tight 600 20px, „.AI“ `#00B8D4`). Rechts: Textbuttons Login · Übersicht · KI-Systeme · Klassifizierung · Enforcement · Evidence · Berichte · Preise (Inter 500/600 13px, 34px hoch, Radius 6px; aktiv `#1E5AFF` Fill; Schlüssel-Screens Übersicht/Preise in `#F2F5FA`, Rest `#8A95AC`), DE→EN-Toggle (JetBrains Mono 11px, Border `#1F2B48`), CTA „Free Audit starten“ (40px, Radius 8px, `linear-gradient(180deg,#2B66FF,#1E5AFF)`, Border `rgba(255,255,255,.14)`, Schatten `0 1px 0 rgba(255,255,255,.12) inset, 0 8px 24px rgba(30,90,255,.3)`).
- Hero-Block (Padding 56px 48px, max 940px): Badge „EU AI Act · DSGVO · ISO 42001“ (28px, Radius 4px, Border `rgba(0,184,212,.35)`, BG `rgba(0,184,212,.08)`, Inter 600 11px, tracking .1em, `#4FD4E8`, Punkt 6px `#00B8D4` mit Glow). H1 zweizeilig: „AI Compliance“ / „Operations OS **for Europe**“ — Newsreader 400 80px/1.0, tracking −.02em, `#EEF1F6`, „for Europe“ `#00B8D4`, `white-space:nowrap`, `text-shadow 0 2px 40px rgba(0,0,0,.6)`. Loop-Zeile: DISCOVER → CLASSIFY → ENFORCE → PROVE (JetBrains Mono 600 13px, tracking .18em, `#4FD4E8`, Pfeil-Icons 14px, Gap 14px, margin-top 36px). CTAs (margin-top 40px, Gap 14px): Primary 52px wie Nav-CTA mit Pfeil-Icon 18px; Secondary „Live Dashboard ansehen“ 52px, Border `#2E3C5E`, BG `rgba(13,19,34,.7)`, `backdrop-filter: blur(12px) saturate(140%)`, hover Border `#4FD4E8`.
- Mobile: Karte oben `rotateX(18deg)`, Vollbild-Menü über Burger (BG `rgba(2,5,11,.96)`, Buttons 48px Radius 8px), H1 Newsreader 44px, CTAs 52px volle Breite, Trust-Zeile DSGVO · EU AI Act · ISO 42001 · EU-Hosting (Inter 600 10px uppercase `#8A95AC`).

### 2 Login `/login`
Zweispaltig 1fr/1fr. Links (max 460px): Zurück-Link, H2 „Anmelden“ (Inter Tight 600 32px/1.15), Sub „Magic Link per E-Mail — kein Passwort, kein Drittanbieter.“ (`#8A95AC` 15px), Label E-MAIL (Overline), Input 44px Radius 4px Border `#2E3C5E` BG `#0D1322`, Button „Magic Link senden“ 44px `#1E5AFF`. Nach Senden: Karte mit Check-Icon `#10B981` „Link gesendet“ + E-Mail, Button „Dashboard öffnen“. Rechts: BG `#0D1322`, Border-left `#1F2B48`, Overline „Trust · Runtime“ cyan, Zitat 28px Inter Tight, Mono-Zeile „Supabase EU (Frankfurt) · Magic Link · Ed25519 · SHA-256 Hash-Chain“.

### 3 Free Audit `/audit`
Grid 320px / 1fr. Sidebar `#0D1322`: Overline „Free Audit · 0 €“, Titel „Ihr KI-Bestand in vier Fragen.“, Stepper (5 Schritte; aktiv BG `#14203A`, Dot 24px: done `#10B981` ✓, aktiv `#1E5AFF`, offen Border `#2E3C5E`). Content (Padding 56px 64px): Frage als H2 32px, Hinweis 15px `#8A95AC`.
Schritte: (0) Unternehmen + Domain (Inputs 48px); (1) Rahmenwerke Chips DSGVO / EU AI Act / ISO 27001 / 42001 / NIS2-TISAX-DORA (44px, Radius 8px; aktiv Border `#1E5AFF` BG `rgba(30,90,255,.18)`); (2) KI-Systeme 2-spaltig mit Klassen-Label (Website-Chatbot A, M365 Copilot C, HR-Screening A, Scoring eigene API C, Code-Agent CI/CD B, ChatGPT im Browser D); (3) Rolle (Ich selbst / Team bis fünf / Agentur / Konzern-SSO); Lauf: Progressbar 6px `linear-gradient(90deg,#1E5AFF,#00B8D4)`, Mono-Log 4 Zeilen à 650ms; Ergebnis: Score-Ring 180px (Stroke 10, Farbe ≥75 `#10B981`, ≥50 `#F5A524`, sonst `#E5484D`), „Ihre drei kritischen Risiken“ mit Artikelreferenzen, Plan-Empfehlung (BG `rgba(30,90,255,.14)`, Border `rgba(30,90,255,.35)`). Footer: Zurück (Outline) / Weiter · Audit starten · Dashboard öffnen (Primary; disabled opacity .45).
Score-Logik: `max(28, 92 − systeme×9 − (rahmenwerke>2 ? 8 : 0))`. Empfehlung: Konzern→Enterprise, Agentur→Agency, ISO/NIS2 oder Hochrisiko-System→Growth, sonst Starter.

### 4 Preise `/pricing`
Header 22px 48px mit Logo, Nav-Chips, Toggle Monatlich / Jährlich −17 % (Segment 30px, aktiv `#1D2B48`). H2 40px „Vom kostenlosen Audit bis zur Agentur-Suite.“ Fünf Karten `repeat(5,1fr)` Gap 12px, Radius 16px, Padding 22px 20px, min-height 380px: Free Audit 0 € · Starter 79 € · Growth 249 € (Beliebt: Border `#1E5AFF`, BG `rgba(30,90,255,.08)`) · Agency 699 € · Enterprise ab 1.249 € (jährlich 790 / 2.490 / 6.900 / ab 12.490). Preise **immer aus `tierById`** lesen. Feature-Zeilen mit Check 14px `#00B8D4`. CTA 40px: Beliebt/gewählt Fill `#1E5AFF`, sonst Outline `#2E3C5E`; Labels „Free Audit starten“ / „14 Tage testen“ / „Gespräch anfragen“ / „Ausgewählt ✓“. Fußnote § 19 UStG (Inter 12px `#5A6684`).

### 5 App-Shell (alle `/app/*`)
Grid 248px Sidebar / 1fr. Sidebar `#0D1322`, Border-right `#1F2B48`, Padding 16px 12px: Logo-Mark 28px Gradient `135deg #1E5AFF→#00B8D4` + Shield-Icon, Tenant-Name Mono 10px. Nav-Items 38px Radius 8px (aktiv BG `#14203A`), Lucide-Icons 18px: Übersicht (home), KI-Systeme (cpu, Badge 8), Klassifizierung (scale, Badge unklassifiziert), Enforcement (shield, Badge 7), Evidence (file-check, Badge Ketten-Länge), Berichte (bar-chart), Abrechnung (credit-card). Unten Plan-Box (Border `#1F2B48`, BG `#070B14`) mit „Plan wechseln“.
Header 56px `#0D1322`: Titel 15px Inter Tight + Sub 13px `#5A6684`; rechts Chips Landing · Preise · Login, DE/EN, Pill „RUNTIME LIVE“ (`rgba(16,185,129,.12)` / `#10B981`), Pill „EU · Frankfurt“ Mono, Avatar 30px „DK“.
Mobile: Header 58px-top mit Burger, Tab-Bar 5 Tabs (Übersicht, KI-Systeme, Enforcement, Evidence, Berichte; aktiv `#00B8D4`, sonst `#5A6684`, Icon 20px + Label 9px uppercase), Padding-bottom 30px.

### 6 Übersicht `/app/dashboard`
Grid `280px repeat(4,1fr)` Gap 12px. Score-Karte (row-span 2): Ring 160px Stroke 10, Score-Wert 44px Inter Tight, Delta Mono „+4 · 7d“, drei Framework-Balken 4px (DSGVO `#1E5AFF`, EU AI Act `#F5A524`, ISO 42001 `#7C5CFF`). Vier KPI-Karten (Padding 16px): KI-Systeme 8 / Hochrisiko 2 (`#F5A524`) / Policies aktiv 7 / Evidenz-Einträge n (`#00B8D4`) — Wert 30px Inter Tight, Sub 12px. Karte „Durchsetzbarkeits-Klassen“ (span 2): Stacked Bar 10px A `#10B981` B `#00B8D4` C `#F5A524` D `#E5484D` + Legende. Karte „Letzte Evidenz“ (span 2): 4 Zeilen `#seq · Event · Hash-Kurzform`. Darunter „Braucht Aufmerksamkeit“: 3 Karten (ChatGPT im Browser / Kreditwürdigkeits-Scoring / Bewerber-Ranking) mit Klassen-Tag.
Score-Formel: `38 + klassifiziert/8×26 + blockierende/7×24 + (verifiziert ? 12 : 0)`.

### 7 KI-Systeme `/app/ai-systems`
Filter-Pills 32px (Alle, A · Inline, B · Schranke, C · Nachgelagert, D · Kein Zugriff), Zähler Mono rechts. Tabelle Grid `2fr 1.2fr 1fr 1.3fr 1fr 1fr`: System (Name 600 + Owner 11px), Typ, Klasse (Badge 26×22 Radius 4, Farbe der Klasse @ 13 % BG), Risikostufe (Pill 22px), Art. 50 (Aktiv `#10B981` / —), Status (Überwacht / Nicht erfasst). Zeile 12px 16px, Hover `#14203A`, Klick → Klassifizierung. Datensatz: 8 Systeme (s1–s8) siehe `SYSTEMS` in der Datei.

### 8 Klassifizierung `/app/ai-systems/:id`
Grid 300px Liste / 1fr Detail. Detail-Karte Padding 24px: Overline „Typ · Klasse X“ cyan, H2 26px Name, Begründung aus `enforcement-classes` (13px `#8A95AC`), Button „Zu Enforcement →“. Vier Tier-Buttons `repeat(4,1fr)` min-height 84px (Unannehmbar `#E5484D` Art. 5 / Hochrisiko `#F5A524` Art. 6 Annex III / Begrenzt `#00B8D4` Art. 50 / Minimal `#10B981`; aktiv Border in Tier-Farbe, BG Farbe @ 10 %). Zwei Karten: Annex III (Nr. + Notiz) und Art. 50 Toggle (Track 36×20, Knob 16px, aktiv `#00B8D4`). Liste „Pflichten“ je Tier (Art. 9/11/14/49; Art. 50/4; Art. 4/95; Art. 5) — Artikel Mono cyan.

### 9 Enforcement `/app/policy-packs`
Vier Stat-Karten (Policies 7 / Anhaltend `#10B981` / Nachgelagert `#F5A524` / Nur Papier `#E5484D`). Warn-Toast (Border `rgba(245,165,36,.4)`, BG `rgba(245,165,36,.12)`, Icon triangle-alert) bei unzulässigem Verdikt. Policy-Zeilen Grid `1.4fr 1fr auto`: Titel 14px + Regel 12px, Klassen-Badge + System, Segment mit 6 Verdikten (allow · log_only · warn · block · require_approval · react; Mono 11px, 28px; aktiv `#1E5AFF` bei block/require_approval, sonst `#1D2B48`; nicht einlösbare Verdikte opacity .45 + line-through). Erlaubt je Klasse: A/B alle außer react; C log_only/warn/react; D nur log_only. Ablehnung erzeugt Evidence-Eintrag. Fußnote: „Die Klasse wird abgeleitet, nie eingegeben …“.

### 10 Evidence `/app/evidence`
Grid 1fr / 300px. Tabelle `60px 150px 1fr 200px 90px`: Seq (Mono cyan), Zeit (Mono `#8A95AC`), Event + Actor, SHA-256 (Mono, ellipsis), Prev (8 Zeichen). Neueste Zeile BG `rgba(0,184,212,.06)`, Eintritt `rsIn` 200ms. Rechts: Verify-Karte (Ring 88px; idle gestrichelt `#1D2B48`, running Seal-Animation 600ms `stroke-dashoffset 150→0` cyan, ok `#10B981`), Button „Kette verifizieren“, Chain-Head-Karte (Hash break-all, Einträge, Ed25519, EU · append-only), Button „Audit-Bundle exportieren“.

### 11 Berichte `/app/reports`
Grid 2×2 Karten Padding 20px: DSGVO (`#1E5AFF`) Verzeichnis Art. 30 · EU AI Act (`#F5A524`) Konformitätsdossier Art. 11/Annex IV · Evidence (`#00B8D4`) Audit-Bundle · Management (`#7C5CFF`) Summary. Status-Pill Entwurf/Läuft/Bereit, Progress 4px, Button „Erzeugen“ → 5×220ms → „Neu erzeugen“ + PDF / JSON + Sig Buttons + Meta Mono (Zeit · sha256-Kurzform).

## Interactions & Behavior
- Ein globaler Zustand (screen, lang, audit, tiers, art50, verdicts, chain, verify, reports, billing, plan); Web und Mobile rendern denselben State.
- Jede Governance-Aktion (Login, Klassifizierung, Art. 50, Verdikt, Verdikt-Ablehnung, Plan-Wahl, Report, Audit-Abschluss) hängt einen Eintrag an die Hash-Kette: `hash = H(prevHash + event + index)`, `prev = prevHash[0:8]`; ein verifizierter Zustand fällt danach auf „ungeprüft“ zurück.
- Easing überall `cubic-bezier(.2,.8,.2,1)`; 200ms Standard, 600ms Seal. Keine Bounces, kein Hover-Scale.
- Hover: Primary → `#1641C4`; Karten Border → `#2E3C5E`.
- Disabled: opacity .45.

## State Management
`screen`, `lang` ('de'|'en'), `loginEmail/loginSent/loggedIn`, `aStep/aOrg/aUrl/aFw[]/aSys[]/aRole/aRunning/aPct/aLog[]/aDone`, `filter`, `selected`, `tiers{}`, `art50{}`, `verdicts{}`, `toast`, `chain[]`, `verify` ('idle'|'running'|'ok'), `reports{}`, `billing`, `plan`, `chosen`, `menuOpen` (mobile). Datenquellen später: Supabase (Systeme, Policies, Evidence), `tierById` (Preise), `enforcement-classes` (Klassen + erlaubte Verdikte).

## Design Tokens
Farben: BG `#070B14 #0D1322 #14203A #1D2B48`, Hero-BG `#02050B`; FG `#F2F5FA #C9D1E0 #8A95AC #5A6684`; Border `#1F2B48`, strong `#2E3C5E`; Primary `#1E5AFF`, hover `#1641C4`, hell `#7FA0FF`; Cyan `#00B8D4`, hell `#4FD4E8`; Success `#10B981`, Warning `#F5A524`, Danger `#E5484D`, Violet `#7C5CFF`.
Typo: Inter (UI), Inter Tight (Titel), JetBrains Mono (Hashes, Loop, Klassen), Newsreader 400 (nur Hero-H1). `font-feature-settings:"ss01","cv11"`.
Radien: 4 (Inputs, Badges) · 6 (Nav-Chips) · 8 (Buttons, Karten) · 16 (Preis-Karten) · 9999 (Status-Pills).
Spacing: 4/8/12/16/20/24/32/48/56/64.

## Assets
`assets/europe-map-v2.png` — zugeschnittene Europa-Nachtkarte (1052×1152) aus dem Referenz-Screenshot; Text/Nav des Originals sind abgedeckt. Icons: Lucide (shield-check, cpu, scale, file-check-2, bar-chart-3, credit-card, home, arrow-right, triangle-alert, menu).

## Screenshots
`screenshots/01-landing.jpg … 10-pricing.jpg` — Web + Mobile nebeneinander je Screen (Referenz, nicht pixelgenau wegen Canvas-Skalierung).

## i18n
`i18n.json` — alle 104 UI-Strings DE/EN (Schlüssel = `T.de`/`T.en` im Prototyp). Als Basis für `hero-content.ts`/i18n-Modul verwenden; DE ist Default.

## Files
- `RealSync Dynamics AI.dc.html` — Prototyp (Template + Logik; Daten `SYSTEMS`, `POLICIES`, `PLANS`, `T` darin)
- `ios-frame.jsx` — iPhone-Rahmen (nur Präsentation, nicht übernehmen)
- `assets/europe-map-v2.png`
- `github.md` — Screen → Repo-Datei-Zuordnung
- `i18n.json` — DE/EN Copy
- `screenshots/` — 10 Referenzbilder
