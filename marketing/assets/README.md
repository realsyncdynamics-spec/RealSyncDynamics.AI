# Marketing Assets

Brand-Assets für LinkedIn, X, Website + Video-Scripts + Social-Media-Texte.

## Bilder (PNG + SVG-Source)

| Datei | Format | Verwendung |
|-------|--------|------------|
| `logo-square-400.png` | 400×400 | LinkedIn Avatar (klein), X-Profilbild, Slack |
| `avatar-400.png` | 400×400 | Account-Avatar Solo, Welcome-Email |
| `linkedin-banner-1584x396.png` | 1584×396 | LinkedIn Profil-Banner |
| `*.svg` | Vector | Source-Files, beliebig skalierbar |

**SVG-Source bearbeiten** + PNG re-rendern:
```bash
node -e "const fs=require('fs'),{Resvg}=require('@resvg/resvg-js');const r=new Resvg(fs.readFileSync('marketing/assets/avatar-400.svg'),{fitTo:{mode:'width',value:400}});fs.writeFileSync('marketing/assets/avatar-400.png',r.render().asPng());"
```

## Profil-Bild (für Dich persönlich)

**Empfehlung**: kein generiertes KI-Bild, kein Logo. Echtes Foto von dir, weil B2B-Sales auf Vertrauen läuft.

**Specs**:
- 400×400 px, square
- Frontal, Schultern + Gesicht
- Neutraler oder dunkler Hintergrund (passt zu Brand)
- Smile (≥ subtle)
- Business-Casual (Hemd/Pullover, kein Suit nötig in Tech)

**DIY-Tipp**: iPhone Portrait-Mode + 5min später bei `remove.bg` Hintergrund auf Solid-Color (#0A0A0B) tauschen → Brand-konsistenter Look.

## Video-Scripts → `video-scripts.md`

5 Storyboards für 30–60-Sek-Videos:
1. DSGVO-Audit-Demo (60 Sek)
2. Schrems-II-Erklärung (90 Sek)
3. AI-Act-Countdown (45 Sek)
4. Founder-Story selfie-style (60 Sek)
5. Cookie-Banner-Dark-Pattern (45 Sek)

**Production**: Pictory.ai, Synthesia oder OBS+Loom für Screen-Recording.

## Social-Media-Texte → `social-media-texts.md`

20 copy-paste-ready Templates:
- LinkedIn Headline (3 Varianten), About-Section, Featured-Items, Pinned-Post
- LinkedIn Connection-Request-Templates (3 Varianten)
- X/Twitter Bio + Pinned-Tweet + Thread-Hook
- Email-Signatur
- Cold-Email-Subject-Lines + Body

## Komplett-Setup-Reihenfolge (45 Min)

1. **Profil-Foto** machen (10 min) — Selfie + remove.bg
2. **LinkedIn-Avatar hochladen** (1 min) — direkt auf linkedin.com/in/me
3. **LinkedIn-Banner hochladen**: `linkedin-banner-1584x396.png` (1 min)
4. **Headline + About-Section** aktualisieren (3 min) — Templates in `social-media-texts.md`
5. **Featured-Section** erweitern: 3 Links (3 min)
6. **Pinned-Post** veröffentlichen (5 min)
7. **X-Profilbild** + Bio (3 min)
8. **Email-Signatur** in alle Mail-Clients eintragen (5 min)
9. **Erste Connection-Request-Welle**: 5 Personen aus deiner ICP-Liste (10 min)

Nach diesen 45 Min hast du eine konsistente Brand-Präsenz auf 3 Plattformen.
