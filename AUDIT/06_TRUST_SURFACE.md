# 06 — Trust Surface (Legal / Transparenz)

## 1. Erreichbarkeit der Pflichtseiten

Statisch generiert über `scripts/generate-static-legal-pages.mjs` (Teil von
`npm run build`), Routen in `src/App.tsx` eager eingebunden.

| Seite | Route | Repo | Bemerkung |
|---|---|---|---|
| Impressum | `/impressum` | ✅ | `e2e/impressum.spec.ts` (läuft **nicht** in CI); `tests/e2e/legal.spec.ts` läuft ✅ |
| Datenschutz | `/datenschutz` | ✅ `src/features/legal/PrivacyPolicy.tsx` | |
| AGB / Terms | `/agb` | ✅ | |
| AVV / DPA | `/avv` | ✅ | Generator vorhanden |
| Subprozessoren | `/subprozessoren` | ✅ | `sub_processor_changes`-Tabelle + Benachrichtigung |
| Widerruf / Kündigung | ✅ | | Stripe-Portal verlinkt |
| Kontakt | `/contact-sales` | ✅ | |
| Security | ✅ | | `INCIDENT_RESPONSE.md`, kein öffentliches `security.txt` |

**Lücke:** kein `/.well-known/security.txt` (RFC 9116) — für ein Sicherheitsprodukt
ein naheliegender Baustein.

---

## 2. Aussagen zur Datenresidenz — Prüfung

| Aussage | Technischer Befund | Bewertung |
|---|---|---|
| „100 % EU-Hosting" | Supabase EU (Frankfurt), Cloudflare Pages (globales Anycast, EU-Origin), Hostinger VPS EU | **TEILWEISE** — Cloudflare terminiert TLS am nächstgelegenen Edge-PoP weltweit; Verarbeitung ist damit nicht EU-exklusiv |
| Sentry EU | CSP erlaubt `*.ingest.de.sentry.io` — EU-Region korrekt gewählt | ✅ |
| Supabase | `ebljyceifhnlzhjfyxup.supabase.co`, Projekt EU | ✅ |
| Anthropic / OpenAI / Google | 18 Edge Functions rufen Anthropic; Google GenAI und OpenAI im Dependency-Set | **US-Verarbeitung** — steht der Aussage „100 % EU" entgegen |
| Ollama-Fallback | `deploy/ollama-traefik/` real vorhanden | ✅ EU-lokale Option existiert |
| Stripe | US-Konzern, EU-Entität, Standardvertragsklauseln | üblich, gehört in die AVV-Liste |
| Meta / TikTok / LinkedIn Pixel | CSP erlaubt sie; Laden **nur nach Consent** (`src/lib/pixels.ts`, Consent Mode v2 default `denied`) | technisch sauber, aber Drittlandtransfer nach Einwilligung |

**Kernpunkt (Rule 7):** Ein Server in Deutschland belegt keine EU-exklusive
Verarbeitung. Die Aussage „100 % EU-Hosting" ist für die *Datenhaltung* vertretbar,
für die *Verarbeitung* nicht — solange Anthropic/OpenAI/Google im Inferenzpfad stehen
und Meta/TikTok-Pixel eingebunden sind.

**Empfehlung:** Aussage differenzieren in „Datenhaltung: EU (Supabase Frankfurt)" +
„KI-Verarbeitung: wahlweise EU-lokal (Ollama) oder US-Anbieter nach Ihrer Freigabe" —
das ist ehrlicher und verkauft die Ollama-Option als Feature statt sie zu verstecken.

---

## 3. Konsistenz Website ↔ Subprozessorenliste

Nicht abschließend prüfbar ohne die gerenderte Subprozessorenseite. Zu verifizieren,
dass folgende real eingesetzte Verarbeiter gelistet sind:

Supabase · Cloudflare · Hostinger · Stripe · Sentry · Anthropic · Google (GenAI) ·
OpenAI · n8n · Meta · TikTok · LinkedIn · Google (Analytics/Ads)

**Auffällig:** Meta, TikTok und LinkedIn sind über die eigene Website eingebunden.
Fehlen sie in der Subprozessoren-/Datenschutzerklärung, ist das ein
Transparenz-Widerspruch bei einem Anbieter, dessen Produkt genau solche Lücken bei
Kunden aufdeckt.

---

## 4. Findings

| ID | Sev | Kurz |
|---|---|---|
| F-18 | P2 | Eigene Marketing-Pixel (Meta/TikTok/LinkedIn) auf einer DSGVO-Compliance-Plattform; Consent-Gating korrekt, Drittlandtransfer bleibt |
| F-T1 | P2 | „100 % EU-Hosting" deckt die KI-Verarbeitung über US-Anbieter nicht ab |
| F-T2 | P3 | Kein `/.well-known/security.txt` |
| F-T3 | P3 | Subprozessorenliste gegen die real eingebundenen Drittanbieter abgleichen |
| F-13 | P2 | `vercel.json` widerspricht dem „Cloudflare-only"-Narrativ |
