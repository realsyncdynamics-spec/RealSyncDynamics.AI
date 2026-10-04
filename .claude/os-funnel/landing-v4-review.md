# Landing v4 — Prüfung des Claude-Design-Exports

**Stand:** 2026-10-04 · geprüft gegen `main@607d6da` · Quelle: Claude-Design-Projekt,
Datei `dist/realsync-landing-v4.html` („V4 Classical · The Governance AI")
**Zweck:** Referenz für WP7. Übernommen wird die **Optik** (Layout, Typografie,
Farben, Abstände, Sektionsfolge). Kein Text, keine Zahl, kein Status aus dem Export —
Inhalte kommen aus dem SSoT.

Der Export trägt im Skript den Hinweis „Wortlaut aus dem Repo (runtimeVocab.ts,
shared/pricing.ts, implementation-status.ts)". Der Stand dieser Wortlaute ist
etwa der 17.08.2026 — deshalb die veralteten Status unten.

## 1. Blocker — nie aus dem Export übernehmen

| # | Export | Wahrheit | Quelle |
|---|---|---|---|
| X1 | Footer „RealSyncDynamics GmbH · Berlin · Handelsregister HRB · AG Berlin-Charlottenburg" | Einzelunternehmen Dominik Steiner, Neuhaus am Rennweg, **kein** HR-Eintrag | `src/config/company.ts`, `Impressum.tsx` |
| X2 | Alle Links/Formular auf `https://realsyncdynamics.ai` | Domain löst nicht auf; live ist `realsyncdynamicsai.de` → nur relative Routen | `src/config/seo.ts` (`SITE_URL`) |
| X3 | Selbstentpackendes Bundle, Inhalte per Inline-Script, three.js + Texturen von jsDelivr | Prod-CSP: kein `'unsafe-inline'`, kein jsDelivr → leere Seite | `public/_headers` |

## 2. Claims gegen Runtime — nicht übernehmen

| Export sagt | Repo-Wahrheit |
|---|---|
| „99.9 % Uptime SLA", Seal-Line „Letzter Nachweis verankert vor n s · Chain-Height 1.284" | mit **#1352** entfernt (Kommentar in `GovernanceAiHero.tsx`); SLA nur Enterprise „nach Vereinbarung" |
| „Monitoring Live", „Drift wird in Echtzeit erkannt" | `pricing.ts` + `runtimeVocab.ts`: Monitoring/Drift **Coming Soon** (`continuous-domain-monitoring`) |
| „6 Policy Packs", „Alle sechs Policy Packs" | live: DSGVO, EU AI Act, ISO 27001, NIS2 · TISAX/DORA Roadmap (`framework-tisax-dora`) |
| HUD „EU AI ACT READY", „Risk Score 87/100", „1,248 Nachweise" | Fake-KPIs (im Export auf 0×0 kollabiert, aber im DOM) |
| „Alle Daten werden in Europa verarbeitet", „Volle Konformität mit der DSGVO" | Cloudflare-Edge global, CSP erlaubt `*.ingest.sentry.io` und Stripe, AI Gateway „mit EU-Option"; „volle Konformität" = verbotene Claim-Klasse (PLAN §5) |
| „Enforcement statt Empfehlung", Policy Engine „durchsetzen" | PEP-Default `shadow` (`AI_GATEWAY_ENFORCEMENT`, `AGENT_PDP_ENFORCEMENT`, `SITEOS_PUBLISH_PDP`) bis zur Umschaltung |
| „SSO · SCIM · RBAC", „On-Prem" | SSO Vorschau, kein SSO/SCIM-Build (`TenantAdminConsole.tsx`, ADR 0008); On-Prem in keinem Plan |
| Evidence-„Knoten" Berlin · Brüssel · Frankfurt · Stockholm · Paris · Wien | suggeriert Infrastruktur; real: Supabase Frankfurt + Cloudflare |
| „Deutsche Ingenieurskunst" unter STANDARDS | kein Standard |

## 3. Veraltete Status im Export

| Modul | Export | Repo 04.10. |
|---|---|---|
| Stripe Checkout E2E | Preview | live |
| Photoreal Earth Hero | Preview | live |
| C2PA | Roadmap „LIVE" **und** Plattform „GEPLANT" | live |
| Bot-Laufzeit | „nicht in Produktion (17.08.)" | `platform-capabilities`: live · `implementation-status`: preview → **WP7a** |
| Hostinger Worker Runtime | Next | VPS läuft am 04.10. aus → **WP7a** |

Vokabular: rund 10 Status-Labels (LIVE, PREVIEW, IN PREVIEW, NEXT, COMING SOON, GEPLANT,
IN ENTWICKLUNG, BETA, ROADMAP …) statt `live · preview · coming-soon`. Der Badge
„EMPFOHLEN" wird per Skript wie „Preview" gestylt.

Drei Ketten auf einer Seite: Hero 4 Schritte (Discover → Classify → Enforce → Prove,
Eyebrows DETECT/GOVERN/AUTOMATE/MONITOR passen nicht), Plattform 6 andere
(Discover/Assess/Govern/Enforce/Evidence/Audit), live 6 entschiedene (LV2_PIPELINE).

## 4. Darstellung und Technik (gerendert in Chromium)

- Globus startet bei `rotation.y = 4.9` → beim Laden steht Amerika unter „for Europe".
- Drei Audit-Einstiege im Hero (zwei Buttons + Formular).
- Agency-Karte Gold auf Hellgrau → wirkt deaktiviert.
- Kontrast: „Mehr erfahren" (Cyan auf Hellgrau), Severity-Badges, Firmenzeile im Footer.
- TAG/NACHT-Schalter 0×0 (nicht bedienbar); Statusleiste kollidiert: „ISO 2700199.9 %".
- Länge: 13.770 px Desktop, ~27.000 px Mobil; Roadmap mit 32 Karten.
- Gewicht ~5,7 MB: 2,2 MB Bundle (54 Font-Dateien ≈ 1,2 MB, 7 Familien) + 3,5 MB
  3D-Assets (Blue Marble 1,46 MB). d3 + topojson für eine Karte, die nicht auf der Seite ist.
- 8 `:root`-Blöcke, `--titan` mit 5 Werten. Texturen von `three-globe@master` (ungepinnt),
  Google-Fonts-Preconnect.

## 5. Was der Export richtig macht (übernehmen)

- Editorial-Look: Serif-Display, Champagner-Gold auf Schwarz, helle Content-Bänder.
- Preise/Bullets/CTAs 1:1 wie `shared/pricing.ts` (Starter/Growth 14-Tage-Trial nach E-F6,
  Agency ohne Trial, Enterprise `priceOnRequest`).
- „DEMO · BEISPIELDATEN" am Dashboard, „Jahresabrechnung: Coming Soon",
  Enterprise ohne Self-Service-Checkout, Einstieg über `/audit`.
