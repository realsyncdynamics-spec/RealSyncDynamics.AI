# RealSync Dachmarken- und White-Designregel

**Owner-Soll (20.11.2026):** Ein RealSync-Dach für jedes weitere Produkt. Jedes Produkt erhält eine eigene Landingpage auf `realsyncdynamicsai.de`. Alle Landingpages haben dasselbe **weiße Corporate Design**, aber jeweils eine **eigene Hero-Szene**. Der Hauptseiten-Hero ist das animierte 3D-Maskottchen SYNC.

## Architekturregeln

1. **Eine Infrastruktur**: bestehendes React/Vite-Projekt, GitHub, Cloudflare Pages, Supabase-EU-Backend und Stripe-Billing; keine zusätzlichen konkurrierenden Frontend-Hosts, Auth- oder Tenant-Systeme.
2. **Ein Designsystem**: bestehende `pl-*`-Styles und `ProductChrome`/`ProductLanding`/ `MascotStage` wiederverwenden; keine parallelen Landing-Frameworks, keine Neuerstellung derselben Funktionen.
3. **Produkt-Hero individuell**: eigene `StageVariant`-Inszenierung aus `stageScenes.tsx` mit dem vorhandenen `sync-mascot.glb` – eigenes Kameraprofil und produktbezogene Beispielkarte. Status/Bildschirmdemo darf keine live erfüllte Zusage vortäuschen.
4. **Hauptseite als Produktkatalog**: direkte Erreichbarkeit aller einzelnen Marketingseiten. Ein vorheriger Website-Scan ist *nicht* verpflichtend.
5. **Kundenablauf bei Website-Projekten**: Domain → Prüfung → Befunde → optional Landingpage/Frontend-Entwurf (bestehendes Backend beibehalten) → optional **Telefonassistent und/oder WhatsApp-Agent** → Governance, Kontrolle und Freigabe. Auch direkter Produktstart erlaubt.
6. **Status und Preise**: Status nur aus `src/product/implementation-status.ts`; Preise und Entitlements nur aus `shared/pricing.ts`. Eine Preview oder eine technisch erreichbare Route ersetzt keine echte Kunden-End-to-End-Abnahme. Software Factory, Automation OS und Creative Studio erhalten keine eigenen kaufbaren Tarifkarten ohne freigegebenes Angebot.
7. **Freigaben**: Alle Marketing-Änderungen bleiben zunächst auf Branch und Draft-PR. `main`-Merge und produktiver Cloudflare-Deploy brauchen eine gesonderte Einzel-Freigabe. Server, RLS, Auth, Secrets, Migrationen unverändert.

## Seitenfamilie

| Seite | Bestand/Erweiterung | Statusgrenze |
| --- | --- | --- |
| `/` | Hauptseite mit SYNC-3D-Hero und sieben Produkteinstiegen | unveränderte Infrastruktur |
| `/voice-agent` | Bestehende Telefonassistent-Seite aus `/ki-bots` wiederverwendet | Telefonie in Vorbereitung |
| `/landingpage-builder` | vorhandene weiße Website-Builder-Seite | Builder Preview |
| `/app-builder` | vorhandene weiße App-Builder-Seite | Builder Preview |
| `/governance-os` | vorhandene Governance-Seite | Teilfunktionen verfügbar, Kunden-E2E offen |
| `/software-factory` | zusätzliche Content-Variante in vorhandener Vorlage | geplantes Kundenprodukt |
| `/automation-os` | zusätzliche Content-Variante in vorhandener Vorlage | n8n Preview, kein produktiver Kunden-E2E |
| `/creative-studio` | zusätzliche Content-Variante in vorhandener Vorlage | in Vorbereitung |
| `/claude-code-optimizer` | vorhandene zusätzliche Spezialseite | Preview |

## Gestapelte PRs

- Die Basis #2340 enthält den animierten SYNC-Hero und das lokale 3D-Asset.
- Darauf baut #2344 mit dem gemeinsamen weißen Produktsystem und Kundenweg auf.
- **Diese Ergänzung baut auf #2344**, nicht parallel auf `main`. Neue Dateien/Details sollen *nur* in das bestehende System fließen.
- #2350 ist ein separater früherer Entwurf mit überlappenden Dateien und darf nicht parallel in `main` gemergt werden.
- Herkunft des SYNC-3D-Assets als Original aus Higgsfield ist **nicht unabhängig belegt**; ohne Medienbeleg keinen Original-Higgsfield-Claim verwenden.

## Abnahme

Erforderlich: TypeScript, Vitest, E2E, Mobile/Reduced Motion, SPA-Routenliste, SEO-noindex in Draft, Status und Preise. Nach bestandenem Code-Test noch **keine** automatische Produktionsfreigabe.
