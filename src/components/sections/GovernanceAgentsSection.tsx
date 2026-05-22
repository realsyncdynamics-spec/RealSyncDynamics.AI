Dann ganz klar:

```text
Weiterbauen.
Kein Handoff.
```

Der aktuelle Stand ist bereits der richtige Architekturwechsel:

```text
Fake-Live-Marketing
→
ehrlich simulierte Runtime Experience
```

Und genau das müsst ihr jetzt vollständig durchziehen — halbfertig bringt euch strategisch nichts.

# Konkrete Anweisung für Claude

```text
Weiter mit derselben Branch:
fix/home-synthetic-runtime-demo

Nicht stoppen.
Kein Handoff.
Kein neues Architektur-Thema öffnen.

Bitte die verbleibenden Schritte vollständig implementieren:

1. RuntimeCanvasSection.tsx
- useSyntheticRuntimeStream integrieren
- statische runtimeMockEvents vollständig entfernen
- rotierende Demo-Events rendern
- current timestamps anzeigen
- sichtbares Demo-Label beibehalten
- Footer-Hinweis sichtbar halten:
  "Simulierte Telemetrie — keine Live-Produktionsdaten"

2. GlobalRuntimeFeedSection.tsx
- denselben Hook nutzen
- Labels:
  "runtime.log · live" → "runtime.log · demo"
  "streaming" → "demo-streaming"
- keine statischen Timestamps mehr

3. Weitere Label-Fixes
- LiveScanCanvasSection:
  "findings · live" → "findings · demo"

- GovernanceAgentsSection:
  status badges:
  "live" → "demo"

- HeroSection:
  nur echte dynamische Elemente dürfen "live" bleiben
  falls nur CSS/DOM-Simulation → ebenfalls "demo"

4. Cleanup
- keine doppelten Event-Quellen
- keine alten hartcodierten 07:14:xx timestamps
- keine versteckten live-claims mehr

5. Validation
- npm run lint
- npm test
- npm run build

6. Danach PR öffnen

Title:
fix(home): replace fake live telemetry with labeled synthetic runtime demo

Description:
Replaces static fake-live runtime behavior with a clearly labeled synthetic runtime demo using rotating events, current timestamps, and randomized delays. Removes misleading live/streaming claims while preserving the operational runtime experience.

Non-goals:
- no backend
- no Supabase realtime
- no telemetry ingestion
- no API calls
- no Edge Functions
- no production telemetry
```

Das ist jetzt kein kosmetischer Fix mehr.

Das ist:

```text
der Übergang von:
„AI Landingpage“
zu:
„Governance Runtime Experience“
```

Und genau das ist strategisch extrem wichtig.
