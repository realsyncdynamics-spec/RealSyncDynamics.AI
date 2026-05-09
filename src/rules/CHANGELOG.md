# Rules Registry Changelog

Versionierte Compliance-Regeln, Tracker-Definitionen und AI-Act-Use-Cases.
Format folgt [Semantic Versioning](https://semver.org/) mit `YYYY.MM.PATCH`.

## Locations

- `src/rules/ai-act.json` — Rule-Engine für DSGVO/AI-Act-Verstöße
- `src/rules/annex-iii.json` — EU-AI-Act Annex-III Use-Case Registry
- `supabase/functions/_shared/rules/tracker-registry.json` — Tracker- und Cookie-Klassifikation

Alle Files tragen ein `version` Feld als Source-of-Truth. Die Versionen sind
voneinander unabhängig — eine Tracker-Update bricht nicht die AI-Act-Engine
und umgekehrt.

---

## annex-iii.json

### 2026.05.0 — 2026-05-09 (initial)

- 8 Annex-III-Kategorien aus Verordnung 2024/1689
- 14 Use-Cases mit Triggers, Severity, Obligations, Norms
- 14 Obligations im Glossary, gruppiert in 4 Phasen (Doku → Human-in-Loop → Logging → Governance)
- Phasen-Metadata mit Effort + Estimated-Days

**Quelle:** EU AI Act Regulation 2024/1689, Annex III (in conjunction with Art. 6 + Recitals 49-66).

---

## tracker-registry.json

### 2026.05.0 — 2026-05-09 (initial)

- 18 Tracker dokumentiert: GA4, GTM, Meta Pixel, TikTok Pixel, LinkedIn Insight, Hotjar, Clarity, Google Fonts, YouTube, Google Maps, Pinterest, Twitter/X, Intercom, HubSpot, Stripe.js, Plausible, Matomo
- Pro Eintrag: `consent_required`, `risk`, `third_country_transfer`, `legal_basis_needed`, `auto_fix` Typ, `needles` (Match-Patterns), `cookie_patterns`

**Update-Cadence:** Bei neuen Trackern in der Wild — siehe `unknown_trackers`-Table für Auto-Discovery-Pipeline.

---

## ai-act.json

### 2026.05.0 — 2026-05-09 (initial, dating back to PR #103)

- 7 Rules: Prohibited (Emotion-Recognition Workplace, Social Scoring), High-Risk (Recruiting, Education, Credit-Scoring), Limited (Chatbot), GPAI (Foundation-Model)
- Pro Rule: norms (AI Act Article-Refs), conditions (fact-based matchers), remediation steps

**Note:** `annex-iii.json` ist der erweiterte Replacement — wird parallel gepflegt bis komplette Migration.

---

## Update-Process

1. **Bei kleiner Korrektur** (Typo, neue Beispiel-Domain): Patch-Version (`2026.05.0` → `2026.05.1`). Eintrag hier mit Datum + One-Liner.
2. **Bei neuem Use-Case oder Tracker**: Minor (`2026.05.0` → `2026.06.0`). Eintrag mit Liste der hinzugefügten IDs.
3. **Bei Schema-Änderung** (z.B. neues Pflichtfeld): Major (`2026.05.0` → `2027.01.0`). Migration-Notes für Konsumenten dokumentieren.

Edge-Functions die die Registry inline duplizieren (z.B. `ai-act-classify`) müssen
bei Major-Updates manuell synchronisiert werden — siehe Kommentar in der jeweiligen Function.

## Auto-Discovery → Manual-Review Workflow

1. Cookie-Scanner detected unknown 3rd-party Script auf Customer-Domain
2. Insert in `unknown_trackers` Table (Migration `20260510*`)
3. Wöchentlicher Review durch Compliance-Lead
4. Promote-to-Registry: neue Entry in `tracker-registry.json` + Version bump
5. `unknown_trackers.reviewed=true` + `registry_id` setzen
