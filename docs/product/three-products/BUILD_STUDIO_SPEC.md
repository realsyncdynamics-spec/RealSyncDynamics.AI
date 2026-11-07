# Produktspezifikation — RealSync Build Studio (BUILD)

Stand 07.11.2026 · Status-Quelle `src/product/productSuite.ts` · Öffentliche Seite `/produkte/build-studio`

## Zielgruppe

KMU mit Kundenkontakt (zuerst Handwerk, K4), Agenturen mit mehreren Kundenseiten, Unternehmen mit
veralteter Website. Entscheider: Inhaber/GF, Marketing; Nutzer: Inhaber, Agentur-Mitarbeitende.

## Nutzenversprechen

Landingpages, Websites und Web-Anwendungen mit KI erstellen, modernisieren und verwalten — mit
Governance-Prüfung vor jeder Veröffentlichung.

## Funktionen und Status

| Funktion | Status | Beleg |
|---|---|---|
| Projekt beschreiben, Vorschau erzeugen (`/build`) | PREVIEW | `src/unified-entry/pages/BuildStudioPage.tsx` |
| Website analysieren (öffentlicher Scan `/audit`) | LIVE | `src/pages/AuditLanding.tsx` |
| Blockbasierter Editor (Puck) mit Seiten, Komponenten, Medien, Daten, Integrationen | PREVIEW | `src/features/siteos/workspace/panels.tsx` |
| KI-Assistent im Editor (Änderungen als neue Version) | PREVIEW | `panels.tsx` |
| Versionierung/Änderungsverlauf (serverseitig) | PREVIEW | `panels.tsx`, `supabase/functions/siteos` |
| Rechtsseiten geschützt (Impressum, Datenschutz, Barrierefreiheit) | PREVIEW | `panels.tsx` |
| Governance-Bewertung je Version (Publish Gate) | PREVIEW | `panels.tsx` |
| Engineering-Oberfläche (Dateien, Code, Vorschau) | PREVIEW | `src/features/app-builder/BoltCodeBuilderPage.tsx` |
| Modernisierungs-Assistent (Enterprise) | PREVIEW | `src/features/siteos/fmt/FmtModernizeWizard.tsx` |
| Veröffentlichung in Vorschau-Umgebung | PREVIEW | Publish Controller (Registry `web-builder`) |
| Eigene Domain zuordnen | PREVIEW | Registry `tenant-custom-domain` |
| DNS-Automatik, Rollback, Self-Service-Livegang | BLOCKED/fehlt | Registry `web-builder` |
| Theme-/Farb-/Typografie-Editor als eigener Bereich | nicht nachgewiesen | Prüfung offen |
| SEO-/Accessibility-Checks als eigene Prüfung | nicht nachgewiesen | Assistent-Vorschlag „Barrierefreiheit verbessern“ vorhanden |
| Chatbot im Projekt aktivieren | NOT IMPLEMENTED | — |
| Individuelles Webdesign (Anfrage) | LIVE | `src/pages/frontend-builder/FrontendBuilderLanding.tsx` |

## Benutzerablauf

1. Domain angeben (→ `/audit`) oder Projekt beschreiben (→ `/build`).
2. Öffentlich zulässige Inhalte strukturiert übernehmen — Nutzungsrechte prüft der Kunde.
3. KI erzeugt SiteOS-Blueprint / Seitenstruktur.
4. Vorlage oder individuelle Gestaltung wählen.
5. Bearbeiten im visuellen Editor (`/builder/:slug`) oder im Code (`/builder/:slug/code`).
6. Vorschau Desktop/Tablet/Mobil.
7. Publish Gate bewertet die gespeicherte Version.
8. Freigabe durch berechtigte Person → Vorschau-Veröffentlichung.
9. Livegang auf eigener Domain — **gesperrt**, bis DNS/Rollback vorhanden.

## Screens

`/produkte/build-studio` (öffentlich) · `/build` · `/builder/:slug` · `/builder/:slug/code` · `/app/siteos` ·
`/app/siteos/modernize` · `/app/websites`.

## Datenflüsse und APIs

Browser → Edge Function `siteos` (Projekt, Versionen, Publish Gate, `site-entitlements.ts`) → Postgres (RLS je
Mandant). Kauf/Upgrade: `checkout-siteos-project`, `stripe-checkout`. Kein zweites Builder-Backend:
SiteOS-Blueprints und `app_builder_projects` bleiben getrennte Objekte; der Workspace verbindet sie nur in der UI.

## Abhängigkeiten

Supabase Auth/Tenant, `shared/pricing.ts` (`siteos.builder`, `siteos.publish`, `limit.sites`), Cloudflare (Vorschau),
Governance Runtime (Publish Gate), AI Gateway (KI-Assistent, protokolliert).

## Kommerzielles Modell

Builder-Zugang und Anzahl Websites hängen am Tarif (`limit.sites`: Free 0 · Starter 1 · Growth 3 · Agency 10 ·
Enterprise 25). Einmalige Leistungen (individuelles Webdesign) über Anfrage. Keine neuen Preise.

## Abnahmekriterien

- [ ] Projektanlage nur mit `siteos.builder` und freiem `limit.sites`-Kontingent (serverseitig geprüft).
- [ ] Jede Änderung erzeugt eine Version; Rechtsseiten nicht löschbar.
- [ ] Veröffentlichung nur nach Publish-Gate-Bewertung und Freigabe einer berechtigten Rolle.
- [ ] Mandantentrennung: Projekt eines Mandanten für andere unsichtbar (RLS-Test).
- [ ] Kein Livegang auf eigener Domain ohne DNS-Prüfung und Rollback-Pfad.
- [ ] Produktseite zeigt nur Status aus der Registry.
