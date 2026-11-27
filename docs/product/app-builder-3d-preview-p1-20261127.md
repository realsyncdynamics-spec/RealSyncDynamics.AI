# P1 – Vorhandenen 3D-Builder als Vorschau im RealSync App Builder wiederverwenden

**Stand:** 27.11.2026 · **Status:** Review-/Preview-Entwurf, kein Produktiv-Go-live.

## Bestandsinventur und Herkunft

| Quelle | Bestandsbefund | Integrationsentscheidung |
| --- | --- | --- |
| `landingpage-3d-builder/src/lib/viewer.ts` | Three.js-Viewer mit gemeinsamem WebGL-Renderer, `mount/update/dispose`, vier Geometrien und 2D-Canvas-Ausgabe | Als `src/features/app-builder/three-preview/viewer.ts` übernommen; vor dem WebGL-Start wird nun der 2D-Kontext geprüft |
| `landingpage-3d-builder/src/app/Scene.tsx` | React-Effekt für Mount/Update/Dispose | Als `ThreeScenePreview.tsx` mit relativen Imports und ehrlicher SVG-Ersatzansicht adaptiert |
| `landingpage-3d-builder/src/lib/project.ts` | Eigener Zustand (Zustand), lokale Browserpersistenz und separate Projekttypen | **Nicht** übernommen: SiteOS/Puck und Bolt-FileStore sind bereits vorhanden |
| `landingpage-3d-builder/src/lib/export.ts` | Eigenständiger HTML-/Runtime-Export | **Nicht** übernommen: Der bestehende governte HTML-Preview-/Persistenzpfad bleibt unverändert |
| `landingpage-3d-builder/src/app/page.tsx` | Next.js-14-Oberfläche mit eigenem Editor | **Nicht** übernommen: Keine zweite App, kein unsicherer Next.js-Server |
| `RealSyncDynamics.AI/src/features/app-builder/BoltWorkbench.tsx` | Auth- und Entitlement-geschützter Workbench-Tab `Vorschau / Code / Prüfpfad` | Neuer, **optionaler** Tab `3D-Objekt` mit `React.lazy`; vorhandene Tabs unverändert |
| `RealSyncDynamics.AI/src/features/siteos/editor/SiteOsBlockEditor.tsx` | SiteOS/Puck-Editor und Datenadapter | Unverändert |
| `RealSyncDynamics.AI/package.json` | React 19 und `three` einschließlich Typen bereits installiert | **Keine neuen Dependencies**, keine Lockfile-Änderung |

**Herkunft:** [Quellrepository](https://github.com/realsyncdynamics-spec/landingpage-3d-builder). Die Viewer-Engine ist bewusst ein adaptierter Bestandsbaustein, kein zweiter Builder und kein Ersatz für die bestehende Steuerung.

## Tatsächlicher Funktionsumfang dieser Phase

- Im vorhandenen, mandanten-/entitlement-geschützten `/builder/:slug/code` erscheint als vierter Reiter `3D-Objekt`.
- Nur beim Öffnen lädt React den Three.js-Code nach; die Probe-3D-Szene wird im Host-DOM gerendert, **nicht** innerhalb des governeden HTML-`srcDoc`-Frames.
- Auswahl von Kugel, Torus, Würfel und Ikosaeder; sichere lokale Bedienfelder für Hex-Farbe, Größe und Drehgeschwindigkeit.
- Beim Verlassen des Tabs gibt der Viewer seinen Canvas und bei der letzten Ansicht den WebGL-Kontext frei.
- Ohne WebGL/Canvas erscheint ausdrücklich eine SVG-Ersatzansicht.
- Der Tab **generiert, speichert, verändert, veröffentlicht oder exportiert keine Kundenwebsite**. Er liest weder lokale Projektdateien noch Supabase-Daten und benötigt keine Schlüssel.

## Sicherheitsgrenzen

1. **Auth, Tenant, RLS, Entitlements:** Unverändert. Der Tab erscheint ausschließlich innerhalb der bestehenden `BoltCodeBuilderPage`-Gates. Keine öffentlichen Routen, kein zusätzlicher Login.
2. **Persistenz:** Der existierende `siteos/code-persist`-Vertrag und der FileStore werden nicht angesprochen oder verändert.
3. **Governance:** `classifyPrompt`, `BoltEngine`, die bisherigen `preview.ts`-Sandbox-Tokens und der Audit-Tab bleiben unangetastet.
4. **Netzwerk:** Der 3D-Viewer enthält keine API-/Provider-Aufrufe, keine eingebundenen CDNs und keine HTML-Generatoren aus untrusted Input.
5. **Lizenz/Abhängigkeiten:** Code stammt aus dem eigenen Bestandsrepo; Three.js war im Hauptrepo schon deklariert. Keine Next.js-14-Runtime und keine zusätzliche Serverarchitektur.
6. **Performance:** `React.lazy` verhindert initiales Laden des opt-in-Panels. Die aus dem Quellprojekt wiederverwendete Engine besitzt einen gemeinsamen WebGL-Renderer und gibt ihn beim letzten Unmount frei.

## Abnahmematrix

| Kriterium | Nachweis | Status |
| --- | --- | --- |
| Genau ein zentraler App Builder; unveränderte Auth-/Billing-/Backendpfade | PR-Dateiliste (nur App-Builder-Frontend, Test und Doku) | Im Diff prüfen |
| 3D-Viewer und React-Lifecycle tatsächlich aus der Quelle abgeleitet | Quell-/Zieldateien und Herkunftskommentar | Implementiert |
| Neuer Tab ist opt-in; kein WebGL auf anderen Tabs | `React.lazy` und bedingtes Panel-Rendering | Implementiert |
| Kein Speichern/Publishing/Kunden-Upload | Lokale Preview-Komponente ohne Write-API; Negativtest | Test im CI ausführen |
| Mount, Form, Farbe, Größe, Speed, Dispose, Fallback | `test/features/app-builder/ThreePreviewPanel.test.tsx` – 7 Tests | CI ausstehend |
| TypeScript-Build und bestehende App-Builder-Regressionstests | GitHub Actions auf exaktem PR-Head | CI ausstehend |
| Korrekte Darstellbarkeit in echtem Browser inkl. WebGL | Manuelle Browserabnahme in geschütztem Testmandanten | Ausstehend |
| Keine Merge-/Produktionsfreigabe | Draft-PR, kein Merge/Deploy | Verbindlich |

**Testbefehle zur späteren Review-Abnahme:**
```bash
npx vitest run test/features/app-builder/ThreePreviewPanel.test.tsx
npm run lint
npm run build:full
```

Der Draft-PR kann die normale Unit-CI des Hauptrepos überspringen; übersprungene Tests sind **nicht bestanden**. Der Build-Workflow und E2E-Workflow dürfen nur als die tatsächlich ausgeführten Prüfungen ausgewiesen werden.

## Nicht in dieser Phase

Kein Prompt-to-3D, keine 3D-Assets im SiteOS-Blueprint, keine Speicherung von 3D-Konfiguration in `app_builder_projects`, keine neue HTML-Exportpipeline, kein Cloudflare-Deploy und keine Migration.

**Folgeschritt (eigene Freigabe erforderlich):** Datenvertrag für 3D-Asset-Blöcke innerhalb des vorhandenen SiteOS/Puck- oder governeden Bolt-Projektmodells entwerfen; vor einem kundenseitigen Speichern müssen tenant-sichere Persistenz, CSP/Sandbox, sichere Exportausgabe, Größenlimits, Accessibility und E2E-Abnahme geklärt sein.
