# RealSync Agent OS

Dies ist das Basis-Repository für das RealSync Agent OS. 

## 🗺 Ordner-Architektur (Feature-Sliced Design)

Damit das Projekt auch mit hunderten Komponenten und Ansichten skalierbar und maintainable bleibt, nutzen wir ein Domain-Driven / Feature-Sliced Design.

### Struktur
- \`/extension/\`: Der vollständige Code für die Chrome Extension (Manifest V3, Service Workers, React Sidebar).
- \`/src/core/\`: Framework-agnostische Geschäftslogik, API-Gateways (\`ai-gateway\`), Entitlements und Auth-Logik.
- \`/src/features/\`: Die Domänen der Anwendung. Alles, was zu einem Feature gehört (z.B. UI, Modale, lokale State-Hooks) liegt hier extrem nah beieinander, z.B.:
  - \`/features/assets/\` (C2PA Siegel, Uploads)
  - \`/features/workflows/\` (Dealflow Automation)
  - \`/features/workspace/\` (Chat, Prompts)
  - \`/features/billing/\`, \`/features/settings/\`
- \`/src/components/\`: Allgemeine / Globale UI Komponenten (Landingpage-Sections, Buttons).
- \`/src/pages/\`: Reines Routing und Struktur, welche die Features auf den Bildschirmen zu einer Ansicht orchestriert (z.B. \`CreatorDashboard.tsx\`).

## 🚀 Status
- **V1.0 (MVP) - Feature Complete**: Copilot (Web & App), Multi-Model Gateway, Entitlements-Basis, Extension ↔ Gateway Integration, UI/UX Mockups für alle SaaS-Module.

(Nächste Phasen: Siehe GitHub Issues Masterplan)
