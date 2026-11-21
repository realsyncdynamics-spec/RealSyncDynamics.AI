# RealSync Dachmarken-Design – White Product System (Entwurf)

**Entscheidung / Ziel:** Eine Dachmarke unter \`realsyncdynamicsai.de\`. Jedes Produkt hat eine **eigene Landingpage** unter der Hauptdomain; alle Seiten verwenden dasselbe **weiße Designsystem** mit einem **eigenen Hero-Motiv**.

## Routen

- \`/governance-os\` – Governance OS
- \`/voice-agent\` – Voice Agent / AI Receptionist
- \`/app-builder\` – App Builder
- \`/software-factory\` – Software Factory
- \`/automation-os\` – Automation OS
- \`/creative-studio\` – Creative Studio

Die Hauptseite \`/\` bleibt der zentrale Produktkatalog. Diese Marketing-Routen ersetzen **keine** bestehenden Produkt-, Scan-, Onboarding- oder \`/app\`-Routen und führen auf vorhandene Funktionspfade.

## Geteilte Gestaltung

Einheitlich: White UI, dunkle Schrift, kühles Blau, eindeutige CTA-Stile, Header/Footer, Responsive, Fokusmarkierung, Motion-Reduced-Mode. Unterschiede ausschließlich in Hero-Motiv, Produkttexten und Feature-Abfolge. Produktstatus aus \`src/product/implementation-status.ts\`; Preise ausschließlich aus \`shared/pricing.ts\`.

## Higgsfield-Hero

Gewünscht: **originaler Higgsfield 3D-Animationsbot** auf der Hauptseite, nicht der früher separat veröffentlichte Glaswürfel-Zyklus.

- Original-Medienexport (MP4/WebM) wurde in dieser Prüfung **nicht im Repository gefunden**; die Higgsfield-App war nicht auslesbar.
- Für Preview/Integration: öffentliche URL des genehmigten Exports als \`VITE_HIGGSFIELD_BOT_VIDEO_URL\` konfigurieren oder Asset im Projekt ablegen und die relative URL setzen.
- Autoplay nur stumm, loop, inline, mit vorhandenem Poster. Bei Ladefehler, fehlendem Asset oder \`prefers-reduced-motion\` bleibt die vorhandene HeroStage als Fallback.
- Keine ungeprüften Fremd-Iframes, keine erfundenen Video-Assets, keine Secrets in \`VITE_*\`.
- Ein echtes „Higgsfield Bot live“-Claim ist erst nach Asset-Anbindung und Browsertest zulässig.

## Governance

Eine Codebase, ein Dashboard, ein Billing, bestehende Supabase-EU-Mandantenstruktur. Kein Deploy, Merge oder Produktionsumschalten durch diesen Entwurf. Produkt-Kunden-E2E getrennt abnehmen.
