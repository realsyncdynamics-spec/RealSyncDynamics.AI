# RealSyncDynamics Design System

Design system for **RealSyncDynamics GmbH** — an enterprise SaaS company based in Berlin, Germany, providing modular platforms for digital verification and secure automation.

> **Source of truth:** <https://realsyncdynamics.de>
> **Tagline:** *Digitale Verifizierung und sichere Automatisierung aus Deutschland*
> **Founded:** 2026 · Berlin, Germany (HRB, Amtsgericht Berlin-Charlottenburg)

---

## Company context

RealSyncDynamics builds SaaS platforms that make digital content, processes, and infrastructure **verifiable, traceable, and secure** for creators, enterprises, and public institutions in Europe. The positioning leans heavily on three pillars:

1. **DSGVO (GDPR) compliance** — all data processed and stored in Europe
2. **C2PA standard** for content authenticity — the open provenance standard backed by Adobe, Microsoft, BBC
3. **"Made in Germany"** — engineering rigor, trust, precision

### The product suite

The company ships **five modular products** that share a platform and brand. Each has a distinct accent color in UI (see `colors_and_type.css`).

| Product | Category | Purpose |
|---|---|---|
| **RealSync Creator OS** | Content Management | All-in-one creator workspace: plan, create, verify, monetize — with AI assistance and provenance tracking |
| **RealSync CreatorSeal** | C2PA & Blockchain | C2PA + blockchain verification for images, video, documents. Tamper detection, audit trail |
| **RealSync Market** | Marketplace | Verified marketplace for digital assets with built-in provenance, licensing, creator payouts |
| **RealSync DealFlow** | Enterprise CRM | B2B deal-management: pipeline tracking, automated workflows, AI-powered forecasting |
| **RealSync LocalFlow** | Smart Infrastructure | Digital infrastructure for municipalities & public institutions: IoT, real-time monitoring, DSGVO-compliant citizen services |

### Pricing tiers

Freemium four-tier model: **Bronze** (free) · **Silver** €49/mo · **Gold** €149/mo *(most popular)* · **Platinum** (custom enterprise).

### Social-proof numbers shown on site

`500+` verified creators · `2M+` protected assets · `99.9%` uptime SLA · `€12M+` transaction volume

---

## Sources used to build this system

| Source | Type | Access |
|---|---|---|
| `https://realsyncdynamics.de` | Live marketing site (text extracted; visual embed blocked by CSP) | Public |
| User briefing (2026-04-22) | Product positioning, personality, color direction | Chat history |

**No codebase or Figma file was provided** — this system is derived from the live marketing site copy + explicit brand direction from the founder. When the codebase becomes available, UI kit components should be re-aligned to match actual implementation (see "Caveats" at bottom).

---

## Content fundamentals

### Language

**Primary language: German.** English is a secondary toggle (`DE / EN` switch in nav). All marketing copy on the live site is German. Technical terms (SaaS, API, Pipeline, Workflow, Dashboard, CRM, Provenance, Blockchain, C2PA, DSGVO, SLA) stay in English — this is standard for German tech.

When writing English, match the same tone: grown-up, precise, confident, restrained. Not breezy, not salesy.

### Tone & voice

- **Formal "Sie" form** in customer-facing copy (*"Sprechen Sie mit unserem Team"*, *"Starten Sie kostenlos"*).
- **First-person plural ("wir")** for company voice: *"Wir entwickeln SaaS-Plattformen, die…"*
- **No first person singular.** No casual "du" anywhere in product copy.
- **Confident declarative sentences.** *"Vertrauen durch Technologie."* *"Made in Germany."* Short, self-assured. Not hedged ("might", "could help you") — definitive ("schützt", "verifiziert", "sichert").
- **Credentials as punctuation.** Copy repeatedly anchors with proofs: "DSGVO-konform", "C2PA-Standard", "99.9% SLA", "Made in Germany", "Deutsche Ingenieurskunst". These are trust markers, not buzzwords.

### Casing

- **Headings:** Sentence case for German, Title Case for product names. Example: *"Modulare SaaS-Plattformen für die digitale Zukunft"* — only "SaaS" is capitalized because it's an acronym.
- **Product names:** Always **RealSync** prefix + PascalCase feature: `RealSync Creator OS`, `RealSync CreatorSeal`, `RealSync DealFlow`. Never `RealsSync`, never `Real Sync`.
- **Parent brand:** `RealSyncDynamics` (single word, camelCase). Legal name: `RealSyncDynamics GmbH`.
- **UI labels:** German capitalizes nouns. *Projekte*, *Einstellungen*, *Integrationen* — always capitalized.

### Vocabulary (signature phrases)

| German | English equivalent | Use when |
|---|---|---|
| *Verifizierung* | Verification | Core verb — the product category |
| *Nachvollziehbar* | Traceable / auditable | Process claims |
| *Provenance* | Provenance | Content origin tracking (keep English) |
| *Tamper Detection* | Tamper detection | Security feature (keep English) |
| *Deutsche Ingenieurskunst* | German engineering | Trust marker, use sparingly |
| *Modular einsetzbar* | Deployable modularly | Product architecture claim |
| *Nahtlos integrierbar* | Seamlessly integratable | Integration pitch |

### Emoji & icon conventions in copy

- **No emoji in product copy, ever.** This is an enterprise SaaS brand selling compliance. Emoji undermine trust.
- **No unicode icon substitutes** (✓, ★, →) in body text. Use real icon components.
- **Em dashes** ( — ) are used liberally in German copy for emphasis. Keep them.
- **Middle dots** ( · ) used as separators in metadata: `EST. 2026 · DEUTSCHLAND`, `Handelsregister: HRB XXXXX · Amtsgericht Berlin-Charlottenburg`.

### Example copy passages (real, from the site)

> **Hero headline:** RealSyncDynamics – Digitale Verifizierung und sichere Automatisierung aus Deutschland
>
> **Hero subhead:** Wir entwickeln SaaS-Plattformen, die digitale Inhalte, Prozesse und Infrastrukturen verifizierbar, nachvollziehbar und sicher machen – für Creator, Unternehmen und öffentliche Institutionen in Europa.
>
> **Section label:** Unsere Lösungen
>
> **Product card example (CreatorSeal):** Digitale Inhalte mit C2PA-Standard und Blockchain-Verifizierung schützen. Nachweisbare Authentizität für Bilder, Videos und Dokumente.
>
> **Trust block:** Alle Daten werden in Europa verarbeitet und gespeichert. Volle Konformität mit der Datenschutz-Grundverordnung.
>
> **CTA pair:** [Demo anfragen] [Pitch Deck / Informationen für Investoren]

---

## Visual foundations

### Color

**Light-first with strong dark-mode support.** The marketing site reads as light + blue-accent enterprise SaaS. The dashboard product skews dark.

**Primary palette — "Verification Blue":**
- **Primary 600** `#1E5AFF` — the hero action color (CTAs, active states, brand link)
- **Primary 700** `#1641C4` — hover / pressed
- **Primary 50** `#EEF3FF` — subtle fills, selected row tints

**Accent — "Seal Cyan":**
- `#00B8D4` — used for verification/security confirmation states, C2PA seal, and secondary accent in data viz. Never for primary CTAs.

**Per-product accents** (used sparingly — product-scoped, never global):
- Creator OS: `#1E5AFF` (primary blue, flagship)
- CreatorSeal: `#00B8D4` (cyan — the "seal" product)
- Market: `#7C5CFF` (violet — commerce)
- DealFlow: `#F5A524` (amber — energy, pipeline momentum)
- LocalFlow: `#10B981` (emerald — public sector, growth, trust)

**Neutrals — "Berlin Slate":** cool, slightly blue-tinted greys, not pure black.
- BG 0 `#FFFFFF` · BG 1 `#F7F9FC` · BG 2 `#EEF1F6` · BG 3 `#E3E8F0`
- FG 0 `#0A1020` (primary text) · FG 1 `#1F2A44` · FG 2 `#4A5878` · FG 3 `#8A95AC` (placeholder)
- Border `#DFE4ED` · Border-strong `#C7CFDE`

**Dark mode:**
- BG 0 `#070B14` · BG 1 `#0D1322` · BG 2 `#14203A` · BG 3 `#1D2B48`
- FG 0 `#F2F5FA` · FG 1 `#C9D1E0` · FG 2 `#8A95AC` · FG 3 `#5A6684`

**Semantic:**
- Success `#10B981` · Warning `#F5A524` · Danger `#E5484D` · Info `#1E5AFF`

### Typography

**Display + UI:** **Inter Tight** (variable) — precise, enterprise, excellent German umlaut rendering.
**Body / long-form:** **Inter** (variable) — proven legibility for dense dashboards.
**Mono / technical:** **JetBrains Mono** — for hashes, API keys, C2PA manifests, blockchain IDs, code blocks.

> ⚠ **Font substitution flag:** No brand font files were provided. All three faces are free Google Fonts selected to fit the "enterprise + technical + German" positioning. If RealSyncDynamics has (or wants) custom faces, replace the `@font-face` declarations in `colors_and_type.css` and drop files into `fonts/`.

**Type scale** (documented in `colors_and_type.css` — semantic vars `--h1` through `--caption`):

| Token | Size | Weight | Use |
|---|---|---|---|
| `--display` | 72/1.02 | 600 | Hero headlines only |
| `--h1` | 48/1.08 | 600 | Section openers |
| `--h2` | 32/1.15 | 600 | Card titles, page titles |
| `--h3` | 22/1.25 | 600 | Sub-sections |
| `--h4` | 17/1.35 | 600 | Card titles in dense UI |
| `--body` | 15/1.55 | 400 | Default |
| `--body-sm` | 13/1.5 | 400 | Table cells, dense UI |
| `--caption` | 12/1.4 | 500 | Metadata, labels |
| `--overline` | 11/1.4 | 600, 0.08em tracking, UPPER | Section eyebrows, status badges |

Use `font-feature-settings: "ss01", "cv11"` for Inter's alternate `a`/`g` — it makes the face feel slightly more technical, less default.

### Spacing

8-point base, with a 4-point half step for dense dashboards.

`2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128` (px)

Exposed as `--space-1` through `--space-14`. Prefer `--space-*` tokens over raw px.

### Radii

Three values only — the brand reads as **geometric + engineered**, not soft.

- `--radius-sm` `4px` — form inputs, badges
- `--radius-md` `8px` — buttons, small cards
- `--radius-lg` `16px` — large cards, modals, full panels
- **`--radius-full`** `9999px` — pills and avatars only

No blob-shaped radii. No `border-radius: 24px` on everything. **Most buttons are `8px`.**

### Shadows & elevation

Two-stop elevation, both cool-tinted (not pure-black):
- `--shadow-1` `0 1px 2px rgba(10,16,32,.04), 0 1px 3px rgba(10,16,32,.06)` — resting cards
- `--shadow-2` `0 4px 12px rgba(10,16,32,.06), 0 12px 32px rgba(10,16,32,.08)` — hover, menus, modals
- `--shadow-focus` `0 0 0 3px rgba(30,90,255,.22)` — keyboard focus rings

Dark mode uses the same shadows but with a faint inner stroke (`box-shadow: inset 0 0 0 1px rgba(255,255,255,.04)`) to separate cards from background.

### Borders

- Default: `1px solid var(--border)` (`#DFE4ED`)
- Strong: `1px solid var(--border-strong)` for separators between logical regions
- Focus/selected: `1px solid var(--primary-600)` with `--shadow-focus`
- **Never** use colored left-border-only cards (a specific "AI slop" trope).

### Backgrounds, imagery, and motifs

**The signature motif is the C2PA seal / verification mark.** Think: a hexagonal or circular "stamp" with concentric rings, a center check, a hash trailing out of it, or a waveform threaded through a shield.

- **Marketing pages:** Mostly white/slate with subtle blueprint-grid patterns (1px cool-grey lines, 32px spacing) and soft radial gradients from Primary 50 in hero areas.
- **Product dashboard:** Dark (`BG 1` `#0D1322`) with subtle dot-grid (`4px` dots, `24px` spacing, `rgba(255,255,255,.03)`).
- **No full-bleed hero photography.** This brand is about data integrity, not vibes.
- **No hand-drawn illustrations.** Everything geometric.
- **Allowed illustrative treatments:**
  - Isometric 3D "sealed document" or "verified block" compositions (placeholder SVG provided in `assets/`)
  - Animated waveform → hash flowing into a seal (CSS/SMIL animation)
  - Blockchain-style chained rectangles with C2PA manifest labels
- **Gradients:** Used sparingly. Only `linear-gradient(135deg, #1E5AFF 0%, #00B8D4 100%)` on rare hero surfaces and the app logo mark. **Never** purple-pink UI gradients.

### Animation

- **Easing:** `cubic-bezier(0.2, 0.8, 0.2, 1)` — a confident spring-ease, not overshooting.
- **Duration:** `120ms` (micro), `200ms` (default transitions), `320ms` (panel / modal), `600ms` (page-scale moves). Nothing longer than `600ms`.
- **No bounces.** Overshoot is too playful for the trust positioning.
- **Fades + small translate (`8–12px`)** for entrance; reversed direction for exit.
- **Hover states:** `200ms` ease; color shift toward Primary 700, or `opacity: 0.9`. No scale transforms on hover for UI chrome.
- **Press states:** `scale(0.98)` + slight darken, duration `120ms`.
- **Loading:** Signature "seal-drawing" spinner — a circle drawing itself, `600ms` ease-out, pausing at 95% then snapping closed. Use for verification actions specifically.

### Transparency & blur

Use backdrop-blur on **sticky nav** (`backdrop-filter: blur(12px) saturate(140%)`) and on **modal scrims** only. Not on cards, not on buttons.

### Layout

- **Marketing max-width:** `1200px` content, `1440px` outer gutters.
- **Dashboard:** Sidebar `248px` fixed, header `56px` fixed, main scrolls.
- **Content grid:** 12-column, `24px` gutter (marketing), `16px` gutter (dashboard).
- **Generous vertical rhythm** on marketing (`--space-14` between sections). Dense on dashboard (`--space-4`).

### Cards

- **Marketing cards:** `BG 0` white, `1px solid var(--border)`, `--radius-lg`, `--shadow-1`, `32px` padding. On hover: `--shadow-2` + `border-color: var(--border-strong)`, no translate.
- **Dashboard cards:** `BG 1`, `1px solid var(--border)`, `--radius-md`, `16px` padding, no default shadow. Hover: `border-color: var(--border-strong)`.
- **Product-category tag** on product cards: small pill above the title, colored with the product's accent at 10% opacity background, accent at 100% text.

### Iconography

See `ICONOGRAPHY` section below.

---

## Iconography

**Icon system: [Lucide](https://lucide.dev)** — linked via CDN (`https://unpkg.com/lucide@latest`). Chosen because:
- Stroke-based, 2px weight — matches the "engineered precision" vibe
- Huge library, consistent 24×24 grid
- No brand icon set was provided by the founder

> ⚠ **Substitution flag:** Lucide is a substitute for an as-yet-undefined official icon set. If RealSyncDynamics wants proprietary icons (e.g. a custom C2PA seal variant, custom chain-link), they should be drawn on the same 24px / 2px stroke grid and dropped into `assets/icons/` as SVG files.

**Usage rules:**
- Always stroke, never filled (except the literal seal mark, which is filled)
- Default size `20×20` in UI, `16×16` in dense tables, `24×24` in marketing cards, `32–64px` for feature illustrations
- Color = current text color (`currentColor`), unless semantic (success = `#10B981`, danger = `#E5484D`)
- Icon + label pairs: `8px` gap, vertically centered
- **Verification/trust icons** used most: `shield-check`, `badge-check`, `fingerprint`, `file-check-2`, `link-2`, `hash`, `lock`, `eye`, `scan-line`
- **Product suite icons** mapped in `colors_and_type.css`: Creator OS → `layers`, CreatorSeal → `shield-check`, Market → `store`, DealFlow → `trending-up`, LocalFlow → `building-2`

**No emoji.** Ever. Even in empty states. Use a Lucide icon at 48px in FG 3 grey.
**No unicode symbols as icons.** `→` and `✓` are fine in inline prose. They are not UI elements.

**The brand mark ("RS" monogram + seal):** A placeholder SVG logo is included at `assets/logo-mark.svg` and `assets/logo-wordmark.svg`. Replace when a real logo is available.

---

## Repository index

```
/
├─ README.md                   ← you are here
├─ SKILL.md                    ← invocation guide for Claude Code / skill-based use
├─ colors_and_type.css         ← all design tokens + @font-face + semantic vars
├─ fonts/                      ← empty; drop custom TTF/WOFF2 here to override Google Fonts
├─ assets/
│  ├─ logo-mark.svg            ← placeholder "RS" monogram w/ seal
│  ├─ logo-wordmark.svg        ← placeholder wordmark
│  ├─ logo-full.svg            ← mark + wordmark locked up
│  ├─ seal-c2pa.svg            ← signature verification seal illustration
│  ├─ pattern-grid.svg         ← blueprint grid background
│  └─ pattern-dots.svg         ← dot-grid background (dark)
├─ preview/                    ← design-system cards shown in the Design System tab
│  ├─ colors-primary.html
│  ├─ colors-neutrals.html
│  ├─ colors-product-accents.html
│  ├─ colors-semantic.html
│  ├─ type-display.html
│  ├─ type-scale.html
│  ├─ type-mono.html
│  ├─ radii.html
│  ├─ shadows.html
│  ├─ spacing.html
│  ├─ buttons.html
│  ├─ inputs.html
│  ├─ badges.html
│  ├─ cards.html
│  ├─ logo.html
│  └─ seal.html
└─ ui_kits/
   ├─ marketing/               ← replica of realsyncdynamics.de
   │  ├─ README.md
   │  ├─ index.html
   │  └─ components/*.jsx
   └─ webapp/                  ← dashboard UI kit (Creator OS flagship)
      ├─ README.md
      ├─ index.html
      └─ components/*.jsx
```

---

## Caveats & known gaps

1. **No codebase or Figma was provided.** UI kits are derived from public marketing site content + brand direction. Real component API/structure will differ.
2. **Font substitution.** Inter / Inter Tight / JetBrains Mono are Google Fonts stand-ins. Flag from the founder needed if custom faces exist.
3. **Icon substitution.** Lucide via CDN; swap in custom set when available.
4. **Logo is a placeholder.** Geometric "RS" monogram generated here. Replace with real brand mark when provided.
5. **Mobile UI kit not yet built** — the brief mentioned responsive mobile. The webapp kit is responsive but there's no dedicated mobile-native kit (e.g. in iOS/Android bezels). Can be added.
6. **No real product screenshots seen.** Dashboard UI kit is a plausible-but-original take on what a "Creator OS" for this brand would look like, grounded in the brand system here. Not pixel-matched to anything real.
7. **German-first.** Copy throughout the UI kits is in German, matching the live site. Swap to English via the same `DE/EN` switch if needed.

---

## How to extend this system

- Add real assets → `assets/` (overwrite placeholders)
- Add custom fonts → `fonts/` + update `@font-face` in `colors_and_type.css`
- Add new product accents → extend the `--accent-<product>` block in `colors_and_type.css`
- Add new preview cards → write HTML into `preview/` and call `register_assets`
- Add new UI kits (e.g. mobile, docs site) → new folder under `ui_kits/` mirroring the structure of the existing two
