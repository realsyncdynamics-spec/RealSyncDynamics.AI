# E2E Routing Infrastructure — Dokumentation

**Datum:** 2026-07-05  
**Status:** ✓ Implementiert und validiert  
**Gültig für:** Haupt-Navigations-Journey (Landing → Scan → Checkout → Dashboard)

---

## Übersicht: Die User Journey

Das System implementiert einen **strukturierten, geführten Navigations-Pfad**, bei dem jede Nutzeraktion (Button-Klick) zu einer klaren, erklärten nächsten Seite führt. Es gibt keine ungeplanten Weiterleitungen, keine Dead Links und keine unerwarteten Umleitungen.

### Hauptpfad: Compliance-Scan → Checkout → Dashboard

```
Start
  └─ Landing: „Scan starten" oder „Anmelden" oder „Preise"
     └─ Scan-Erklärung (Domain eingeben)
        └─ Scanner läuft
           └─ Scan-Ergebnis angezeigt
              └─ Maßnahmen erklären
                 └─ Anmeldung (neu oder Login)
                    └─ Paket-Wahl (Starter / Growth / Agency)
                       └─ Checkout-Details
                          └─ Stripe-Checkout (extern)
                             └─ Zahlung erfolgreich
                                └─ Dashboard (Ziel)
```

---

## Routing-Komponenten

### 1. FlowContext (`src/flow/FlowContext.tsx`)

**Aufgabe:** Persistiert den Journey-Zustand in LocalStorage.

**Verwalteter Zustand:**
```typescript
scanDomain: string | null          // Die zu prüfende Domain
scanStarted: boolean                // Scan wurde initiert
scanCompleted: boolean              // Scan-Ergebnis liegt vor
loginIntent: boolean                // Nutzer will sich anmelden
selectedPlan: string | null         // Gewähltes Paket (starter/growth/agency)
checkoutStatus: 'idle'|'started'|'success'|'cancelled'  // Zahlung
lastStepId: string                  // Letzter besuchter Flow-Schritt
visited: string[]                   // Verlauf (für Debuggen)
```

**Speicher-Schlüssel:** `rsd.flow.state.v1`

**Persistierung:** Automatisch bei jeder Zustandsänderung. Fallback auf In-Memory bei Privatmodus.

---

### 2. Flow-Definitionen (`src/flow/flowRoutes.ts`)

**Zentrale Tabelle:** `FLOW_STEPS` — ein Record mit Key = eindeutige Flow-ID.

**Struktur einer Flow-Seite:**
```typescript
{
  id: 'landing.startScan',          // Eindeutige ID (Namensraum.Aktion)
  slug: 'start-scan',               // URL-Slug (/flow/start-scan)
  label: 'Scan starten',             // CTA-Label auf vorheriger Seite
  fromPage: 'Startseite',            // Kontext-Info
  title: 'Compliance-Scan starten',  // Seiten-Überschrift
  clicked: 'Du hast...',             // Bestätigungsmeldung
  explanation: 'Der kostenlose...',  // Was passiert auf dieser Seite?
  stage: 'scan',                     // Fortschritts-Stufe
  primary: { label, to, hint?, external? },  // Primärer nächster Schritt
  secondary: { label, to, ... },    // „Zurück"-Button
  extraActions: [ ... ],            // Weitere Optionen
  stateEffect: { /* State-Updates */ }  // Was persistiert werden soll
}
```

**Stages (Fortschrittsleiste):**
1. `scan` — Scan-Phase (Domain eingeben, Scanner läuft)
2. `ergebnis` — Ergebnis anzeigen + Maßnahmen erklären
3. `anmeldung` — Konto-Erstellung / Login
4. `paket` — Paket-Auswahl
5. `checkout` — Zahlungs-Details + Stripe-Zahlung
6. `dashboard` — Ziel: Konto-Dashboard

---

### 3. Dynamische Routen (`src/flow/FlowStepRoute.tsx`)

**Pattern:** `/flow/*` → beliebig verschachtelte Slugs (z. B. `/flow/checkout/starter`)

**Flow:**
1. URL-Slug wird gelesen (z. B. `checkout/starter`)
2. `getFlowStepBySlug()` findet die entsprechende Flow-Definition
3. `FlowStepPage` wird mit der Definition gerendert
4. Ist der Slug unbekannt → 404-ähnliche Seite mit Link zu `/flow/start-scan`

**Keine toten Enden:** Jede Seite (auch Fehlerseiten) bietet ein Weiterkommen an.

---

### 4. Flow-Page-Rendering (`src/flow/FlowStepPage.tsx`)

**Verantwortung:** Beantwortet drei Fragen für jede Station:

1. **„Wo bin ich?"** (Navigations-Kontext)
   - Überschrift: `step.title`
   - Fortschrittsbalken: zeigt aktuelle Stufe (1/6 bis 6/6)
   - Breadcrumb: `fromPage → title`

2. **„Warum bin ich hier?"** (Erklärung)
   - `step.clicked` — Bestätigung: "Du hast X geklickt"
   - `step.explanation` — detaillierte Erläuterung (1–3 Sätze)
   - Kontext-Chips: zeigt aktuelle State (Domain, Paket, Zahlungs-Status)

3. **„Was kann ich als Nächstes tun?"** (Aktionen)
   - `primary` → meist der logische nächste Schritt
   - `secondary` → „Zurück" oder alternative Hauptroute
   - `extraActions` → z. B. „Ablauf überspringen", „Direkter Zugang"

---

## Routing-Validierung

### Validator (`src/flow/RoutingValidator.ts`)

**Funktion:** `validateRouting()` → prüft auf:

✓ **Eindeutigkeit**
- Keine doppelten Flow-IDs
- Keine doppelten Slugs

✓ **Link-Integrität**
- Alle Action-Ziele sind gültige Routen
- Entweder `/flow/*` oder bekannte externe Route

✓ **Erreichbarkeit**
- Alle Steps sind vom Startstep erreichbar (BFS-Traversal)
- Keine isolierten Sub-Flows ohne Verbindung

✓ **Stage-Abdeckung**
- Alle definierten Stages werden genutzt

### Validierungs-Report

**Funktion:** `generateRoutingReport()` → produziert einen Menschen-lesbaren Report mit:

```
E2E ROUTING VALIDATION REPORT

Status: ✓ VALID

STATISTIKEN:
  • Gesamt Flow-Schritte: 13
  • Gesamt Actions: 45
  • Externe Routes: 9
  • Erreichbare Schritte: 13

FEHLER: (keine)

EXTERNE ROUTES:
  → /app
  → /audit
  → /checkout/agency
  → ... (weitere)

FLOW-STAGES (Fortschrittsleiste):
  scan               → 3 Schritte
  ergebnis           → 2 Schritte
  anmeldung          → 1 Schritt
  paket              → 2 Schritte
  checkout           → 4 Schritte
  dashboard          → 1 Schritt

HAUPT-NAVIGATIONSPFAD (Scan → Checkout → Dashboard):
  ├─ [SCAN] Compliance-Scan starten
  ├─ [SCAN] Domain eingeben
  ├─ [SCAN] Der Scan läuft
  ├─ [ERGEBNIS] Dein Scan-Ergebnis
  ├─ [ERGEBNIS] Empfohlene Maßnahmen
  ├─ [ANMELDUNG] Anmelden
  ├─ [PAKET] Paket auswählen
  ├─ [CHECKOUT] Paket „Starter"
  ├─ [CHECKOUT] Zahlung erfolgreich
  └─ [DASHBOARD] Dein persönliches Dashboard
```

---

## Externe Routes (Integration mit bestehendem App)

Die Flow-Seiten sind **Brücken**, nicht Ersetzungen:

| Flow-Schritt | Externe Route | Was passiert dort |
|---|---|---|
| `scan.domain` | `/audit` | **Echte Domain-Eingabe & Scanner** — vollständige Audit-Interface |
| `landing.pricing` | `/pricing` | **Echte Preisseite** — detaillierte Paket-Vergleiche |
| `landing.login` | `/os/login` | **Auth-Seite** — Magic-Link oder Passwort-Login |
| `pricing.checkoutStarter` | `/checkout/starter` | **Stripe-Checkout** — sichere Zahlungsabwicklung |
| `app.dashboard` | `/app` | **Echtes Dashboard** — Workspace, Scans, Reports |

### Design: Transparent Handoff

- **Flow-Seite erklärt:** "Jetzt öffnet sich die echte Audit-Seite"
- **Hint-Text:** `external: true` auf der Action
- **Kontext-Persistierung:** Der Flow-State wird mitgenommen (z. B. Domain bleibt gespeichert)
- **Rückkehr-Optionen:** Nach einer externen Aktion kann der User zurück in den Flow

---

## Zustand-Management: Flow + State

### State Modell

Die `FlowStateEffect`-Objekte auf jeder Seite definieren, welcher Zustand persistiert werden soll:

```typescript
// Scan-Phase
'scan.running': {
  stateEffect: { scanStarted: true }
}

// Ergebnis-Phase
'scan.finished': {
  stateEffect: { scanCompleted: true }
}

// Paket-Wahl
'pricing.checkoutStarter': {
  stateEffect: { selectedPlan: 'starter', checkoutStatus: 'started' }
}

// Nach Zahlung
'checkout.success': {
  stateEffect: { checkoutStatus: 'success' }
}
```

### Persistierung über Reload

- **Speicher:** LocalStorage (Schlüssel `rsd.flow.state.v1`)
- **Fallback:** In-Memory im Privatmodus
- **Abruf:** Beim FlowProvider-Init wird der State wiederhergestellt

Beispiel: Nutzer lädt `/flow/dashboard` neu → FlowContext stellt den bisherigen Scan-Status wieder her → Dashboard-Link funktioniert im Kontext.

---

## Testing & Validierung

### Unit Tests (`test/flow-routing.test.ts`)

Deckt ab:

1. **Infrastructure-Tests**
   - `validateRouting()` hat keine Fehler
   - Alle Steps sind eindeutig (ID + Slug)
   - Alle Actions verweisen auf gültige Routen

2. **Accessibility-Tests**
   - Alle Steps sind über `getFlowStepBySlug()` erreichbar
   - Alle IDs sind über `getFlowStepById()` erreichbar

3. **Path-Tests**
   - Hauptpfad folgt logischer Reihenfolge
   - Pricing → Checkout-Kette ist intakt
   - Checkout-Abbruch-Handling funktioniert

4. **State-Tests**
   - Scan-Status wird korrekt markiert
   - Paket-Auswahl wird persistiert
   - Checkout-Transaktionen werden geloggt

5. **Documentation-Tests**
   - Jeder Step hat aussagekräftige Title, Explanation, Clicked-Text
   - Report-Generation funktioniert

### Manual E2E Test

```bash
# Validierungs-Report anzeigen
npm run e2e:routing-report

# Tests laufen
npm test -- flow-routing.test.ts

# Browser-Test: /flow/start-scan aufrufen
# → Jeden Button klicken und prüfen, dass die nächste Seite sinnvoll ist
```

---

## Sicherheits-Aspekte

### RLS & Auth

- **Flow-State:** Rein client-seitig (LocalStorage)
- **Externe Routes:** Alle sind auth-gated (z. B. `/app` ist geschützt)
- **No Server Calls:** Die Flow-Seite selbst macht keine API-Calls
- **Session Handling:** Nach Login an `/os/login` wird der Session-Token in Supabase gespeichert

### Validierung & Trust

- **Keine unsicheren Redirects:** Alle Ziele sind hartcodiert in `FLOW_STEPS`
- **Keine User-Input-Routes:** Slugs werden nur aus FLOW_STEPS gelesen, nicht aus URL-Parametern
- **Whitelist:** `EXPECTED_EXTERNAL_ROUTES` dokumentiert alle erlaubten externen Ziele

---

## Compliance & Regulierung

### DSGVO & EU AI Act

Die Flow-Seiten sind **Informations-Brücken**, keine Datensammler:

- ✓ Keine Cookies vor Einwilligung gesetzt
- ✓ Kein Tracking auf Flow-Seiten
- ✓ LocalStorage verwendet nur für Flow-State (keine PII)
- ✓ External Routes (z. B. `/pricing`, `/audit`) tragen jeweils eigene Compliance

---

## Häufige Änderungen: So geht's

### Neue Flow-Seite hinzufügen

1. **Flow-Definition hinzufügen** in `src/flow/flowRoutes.ts`:
   ```typescript
   'newFeature.step': {
     id: 'newFeature.step',
     slug: 'my-new-step',
     label: 'Neue Funktion',
     // ... weitere Properties
   }
   ```

2. **Action-Ziele updaten** (z. B. der vorherige Step zeigt auf die neue Seite):
   ```typescript
   primary: { label: 'Neue Funktion', to: '/flow/my-new-step' }
   ```

3. **Tests updaten:** `test/flow-routing.test.ts` — neue Step-ID in den relevanten Test-Cases prüfen

4. **Validierung laufen lassen:** `npm test -- flow-routing.test.ts` sollte grün werden

### Externe Route hinzufügen

1. Neuen Pfad in die Aktion schreiben:
   ```typescript
   primary: { label: 'Zu Billing', to: '/app/billing', external: true }
   ```

2. Route in `EXPECTED_EXTERNAL_ROUTES` in `RoutingValidator.ts` registrieren:
   ```typescript
   EXPECTED_EXTERNAL_ROUTES.add('/app/billing');
   ```

3. Tests laufen lassen → Warnung sollte verschwinden

### Flow-State erweitern

1. Neues Property zu `FlowState` in `src/flow/FlowContext.tsx` hinzufügen:
   ```typescript
   myNewField: string | null;
   ```

2. In `DEFAULT_STATE` initialisieren:
   ```typescript
   myNewField: null,
   ```

3. In einem Flow-Step `stateEffect` setzen:
   ```typescript
   stateEffect: { myNewField: 'value' }
   ```

4. Tests + Validator updaten falls nötig

---

## Checkliste: Vor Production Push

- [ ] `npm test -- flow-routing.test.ts` ✓ Alle grün
- [ ] `npm run lint` ✓ Keine TypeScript-Fehler
- [ ] Browser-Test: Haupt-Pfad durchlaufen (Landing → Scan → Checkout → Dashboard)
- [ ] Browser-Test: Alternate Routes (Skip options, Zurück-Buttons)
- [ ] Browser-Test: Externe Routes öffnen sich korrekt
- [ ] LocalStorage-Test: Nach Reload ist State noch vorhanden
- [ ] `generateRoutingReport()` in Console zeigt ✓ VALID

---

## Troubleshooting

| Problem | Ursache | Lösung |
|---|---|---|
| **404 auf `/flow/xyz`** | Slug ist nicht in `FLOW_STEPS` | Slug-Namen prüfen, ggfs. neue Step hinzufügen |
| **Button führt zu 404** | `to` in Action ist ungültig | Action-Ziel prüfen: `/flow/*` oder bekannte externe Route? |
| **State wird nicht persistiert** | `stateEffect` ist leer | `stateEffect` in Flow-Definition setzen |
| **LocalStorage nicht vorhanden** | Privatmodus / Sandboxing | Fallback auf In-Memory funktioniert, aber kein Reload-Persistierung |
| **Ungültige externe Route** | Neue Route hinzugefügt, aber nicht registriert | Route in `EXPECTED_EXTERNAL_ROUTES` hinzufügen |

---

## Zukunfts-Roadmap

### Phase 2 (Q3 2026)
- [ ] Alternate Flows: z. B. „Nur Upload der Domain-Liste" ohne Scan
- [ ] Personalisierte Recommendations basierend auf Scan-Ergebnis
- [ ] Team-Einladungs-Flow nach Checkout

### Phase 3 (Q4 2026)
- [ ] Analytics: Track welche Flow-Pfade Nutzer nehmen
- [ ] A/B-Testing: Unterschiedliche Explanations-Texte pro Variante
- [ ] Multi-Language: Flows für DE / EN / FR

---

**Zuletzt aktualisiert:** 2026-07-05  
**Maintainer:** Claude Code (AI)  
**Feedback:** Issues / PRs gegen Branch `claude/cloud-code-e2e-routing-*`
