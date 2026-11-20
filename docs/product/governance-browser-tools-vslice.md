# Governance Browser – KI-Werkzeuge, Vertical Slice 01

**Stand:** 20.11.2026 · **Status:** Draft, weder auf `main` noch produktiv freigegeben.

## Absicht und bestehende Architektur

Additive Erweiterung des bereits vorhandenen Governance Workspace mit REA-Prüfpfad aus PR #2319. Kein zweiter App-Shell-, KI-Gateway-, Tenant-, Billing- oder Evidence-Pfad. Die sechs eigenständigen RealSync-Produkte gemäß Zielarchitektur bleiben eigenständig; die KI-Werkzeuge sind **Funktionen innerhalb des Governance Browsers**, keine neuen eigenständigen Tarife oder Produktseiten.

Die bestehende `GovernanceWorkspaceRoute` bleibt hinter `AppGate` und `VITE_GOVERNANCE_AI_ENABLED` (standardmäßig **aus**). Keine Änderung an `src/App.tsx`, `src/config/featureFlags.ts`, `src/product/implementation-status.ts`, SQL, Edge Functions, Secrets oder Produktion.

## Slice 01 – Benutzerweg

1. Autorisierter Nutzer öffnet `/app/workspace`, sofern separat freigegeben.
2. Die **bestehende Eingabe** erscheint beim Start über den Werkzeugkacheln. Nach dem ersten Chat-Turn bleibt die gleiche Eingabe am bisherigen unteren Platz. Kein zweiter Prompt oder zweiter Netzwerkaufruf.
3. **Voice-Bot** (`/app/voice`) und **Governance OS** (`/app/dashboard`) stehen als hervorgehobener Direktzugriff **vor** Vorschlägen und allgemeiner KI-Werkzeugliste. Beide bleiben separate RealSync-Produkte, nicht Teil eines nachgebauten Genspark-Dienstes. Der Voice-Livebetrieb ist weiterhin offen.
4. `KI-Chat` nutzt unverändert `ai-gateway` mit Nutzer-JWT, `tenant_id`, `trace_id` und REA-Prüfpfad.
5. `App-Builder` schaltet den bestehenden Build-Modus um; die Übergabe und seine eigenen Berechtigungen bleiben unverändert.
6. Dokumente, Agenten, Voice, Governance, Evidence und Audits verlinken nur vorhandene interne Routen. Ihre produktive Funktionsfähigkeit ist dadurch **nicht** nachgewiesen.
7. Fehlende Generatoren `KI-Folien`, `KI-Tabellen`, `KI-Bild`, `KI-Video` und `Übersetzungs-Hub` sind sichtbar, aber nicht ausführbar. Es gibt keine Mock-Ausgaben und keine kostenpflichtigen Provider-Aufrufe.

## Abnahmebedingungen

- Katalog-Tests: acht KI-Kacheln und eigenständige RealSync-Module; keine doppelten IDs; fehlende Werkzeuge gesperrt.
- Integrations-Tests: eine einzige Eingabe; bestehender Gateway-/REA-/Builder-Vertrag; keine neue Backend-Route.
- Bestehende Tests aus PR #2319 sowie `npm run lint`, `npm test`, `npm run build`, `npm run check:spa-routes` in CI; bis zur Bestätigung **nicht bestanden behaupten**.
- Übergeordneten REA-PR #2319 zuerst prüfen/abnehmen. Dieser PR ist ein **gestapelter Draft** und darf nicht ungeprüft unabhängig nach `main` gemergt werden.
- Produktiv-Freigabe separat: Auth/Tenant/RLS, Policy & Entitlement, Residency, Datenspeicherung, Kostenreservierung, REA/Evidence, Human Approval, Provider-Test und E2E.

## Fortsetzung ohne Umbau

- **Slice 02 KI-Dokumente:** bestehendes Governance-Dokumentmodul um eine allgemeine Dokument-Auftragsart ergänzen, erst nach geprüften Speicherung-/Export-/Mandantenverträgen.
- **Slice 03 KI-Tabellen/Folien:** bestehende Berichtsdaten über kontrollierte Artefakt- und Export-Adapter nutzen; keine ungeprüften Editoren als live auszeichnen.
- **Slice 04 Bild/Video:** geschlossene Entwürfe #2271/#2288 höchstens als technische Referenz; neue, gesondert geprüfte Integration hinter bestehenden Gateway-/Budget-/Evidence-Gates; keine neuen Edge Functions bei bestehendem Limit ohne Bestandsabbau.
- **Slice 05 Agenten, Voice, Übersetzung, Notizen/E-Mail:** vorhandene Module, Agenten-/Voice-Adapter und Berechtigungssysteme adaptieren, niemals parallel neu aufbauen.

**Quelle:** bestehender `GovernanceBrowserShell`, `GovernanceWorkspace`/REA-Entwurf, `workspaceGuideModel`, `docs/architecture/target-architecture.md`, Zielarchitektur-Entwurf PR #2369. Keine Freigabe oder Laufzeitnachweise durch dieses Dokument.

## Ergänzung 20.11.2026 – Direktzugriff

- Die vorhandenen Voice- und Governance-Routen wurden lediglich in den obersten Bereich der bestehenden Workspace-Kachelansicht verschoben.
- Keine Veränderung am Voice-Router, Governance-Dashboard, App-Shell oder deren API-, Entitlement- und Evidenzverträgen.
- Der Governance-OS-Einstieg öffnet das zentrale `/app/dashboard`; das KI-Register bleibt unter `/app/ai-systems` erreichbar.
- Statuskennzeichnungen im Workspace sind keine Live-Audio- oder produktive Governance-Abnahme.
