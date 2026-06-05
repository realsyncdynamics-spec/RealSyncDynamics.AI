# Governance OS — Inspector Panel

Dokumentation für `GovernanceInspectorPanel` — den kontextsensitiven Slide-in-Drawer
des Governance OS Dashboards.

---

## Inhaltsverzeichnis

1. [Komponenten-Übersicht](#1-komponenten-übersicht)
2. [API & Props](#2-api--props)
3. [Verwendungsbeispiele](#3-verwendungsbeispiele)
4. [Keyboard Shortcuts](#4-keyboard-shortcuts)
5. [Testing Guide](#5-testing-guide)

---

## 1. Komponenten-Übersicht

### Zweck

Der Inspector Panel ist ein **420 px breiter Slide-in-Drawer**, der sich von der rechten
Bildschirmseite einschiebt, wenn ein Nutzer auf eine Zeile im Governance Dashboard klickt.
Er ersetzt die sofortige Navigation zur Detail-Route — der Nutzer bleibt im Dashboard-Kontext
und kann schnell zwischen Items wechseln.

### Datei

```
src/features/governance/GovernanceInspectorPanel.tsx
```

### Architektur

```
GovernanceInspectorPanel          ← Shell (Overlay + Drawer)
├── EventInspector                ← Inhalt für governance_events
├── AssetInspector                ← Inhalt für governance_assets
└── PolicyInspector               ← Inhalt für governance_policies
```

Die Shell verwaltet Sichtbarkeit und Tastatur-Listener. Die drei Unter-Komponenten
sind **rein intern** und werden ausschließlich durch die Shell gerendert.

### Verhalten

| Zustand | Beschreibung |
|---------|-------------|
| `selection === null` | Drawer ist per `translate-x-full` aus dem Viewport geschoben; kein Backdrop |
| `selection !== null` | Drawer fährt ein (200 ms ease-out); semitransparentes Backdrop überlagert den Hauptinhalt |

Beim Öffnen werden **lazily** zusätzliche Daten geladen:

- `EventInspector` — lädt verknüpfte Evidence via `fetchEvidenceForEvent(event.id)`
- `AssetInspector` — lädt die letzten 5 Ereignisse via `fetchEventsForAsset(asset.id, 5)`
- `PolicyInspector` — keine zusätzlichen Ladevorgänge (alle Daten im Policy-Objekt vorhanden)

### Inhalte pro Ansicht

#### Ereignis-Inspector (`type: 'event'`)

| Abschnitt | Inhalt |
|-----------|--------|
| Header | Titel + RiskBadge (info / low / medium / high / critical) |
| Zusammenfassung | `summary`-Freitext (optional) |
| Metadaten-Grid | Typ, Quelle, Zeitstempel, Vendor, Modell, Akteur |
| Datentypen | Tags aus `data_types[]` |
| Policy-Entscheidung | `PolicyActionBadge` (allow / log / warn / block / require_approval) |
| Asset-Link | Monospace-Link zur Asset-Detailseite (wenn `asset_id` gesetzt) |
| Evidence | Liste mit Titel, Typ und Hash-Vorschau (8 Zeichen) |
| Payload | Aufklappbarer JSON-Block (`max-h-48`) |
| Fußzeile | „Vollansicht öffnen" → `/governance/events/:id` |

#### Asset-Inspector (`type: 'asset'`)

| Abschnitt | Inhalt |
|-----------|--------|
| Header | Name + RiskScoreBadge (`score/100`) |
| Beschreibung | Freitext (optional) |
| Metadaten-Grid | Typ, AI-Act-Klasse, Status, Aktualisierungsdatum, Vendor, Owner, System-URL |
| Datentypen | Tags aus `data_types[]` |
| Letzte Ereignisse | Bis zu 5 Ereignisse, per Klick in Event-Inspector navigierbar |
| Fußzeile | „Details" → `/governance/assets/:id`; Archivieren-Button (nur wenn `status !== 'archived'`) |

#### Policy-Inspector (`type: 'policy'`)

| Abschnitt | Inhalt |
|-----------|--------|
| Header | Name + RiskBadge (Severity) |
| Beschreibung | Freitext (optional) |
| Metadaten-Grid | Typ, Aktion, Schwere, Erstellungsdatum |
| Status | PolicyActionBadge + aktiv/pausiert-Indikator |
| Bedingung | Aufklappbarer JSON-Block (`max-h-40`) |
| Fußzeile | Toggle-Button: „Aktivieren" / „Pausieren" (ruft `togglePolicy` auf) |

---

## 2. API & Props

### Exportierter Typ `InspectorSelection`

```typescript
export type InspectorSelection =
  | { type: 'event';  item: DbGovernanceEvent  }
  | { type: 'asset';  item: DbGovernanceAsset  }
  | { type: 'policy'; item: DbGovernancePolicy };
```

Der Typ ist ein **getaggtes Union** — der `type`-Diskriminator steuert, welche
Unter-Komponente gerendert wird. `item` enthält das vollständige Datenbank-Objekt
(snake_case, direkt aus Supabase).

### Props `GovernanceInspectorPanel`

```typescript
interface Props {
  selection: InspectorSelection | null;
  onClose:  () => void;
  onChange: () => void;
  onSelect: (s: InspectorSelection) => void;
}
```

| Prop | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| `selection` | `InspectorSelection \| null` | ja | Aktuell ausgewähltes Item; `null` schließt den Drawer |
| `onClose` | `() => void` | ja | Wird bei ESC, Backdrop-Klick und „Vollansicht öffnen"-Link aufgerufen |
| `onChange` | `() => void` | ja | Wird nach schreibenden Operationen aufgerufen (Archivieren, Policy-Toggle); löst üblicherweise einen Dashboard-Reload aus |
| `onSelect` | `(s: InspectorSelection) => void` | ja | Ermöglicht dem Asset-Inspector, auf ein verknüpftes Ereignis zu wechseln, ohne den Drawer zu schließen |

### Interne Sub-Komponenten (nicht exportiert)

| Komponente | Props |
|------------|-------|
| `EventInspector` | `{ event: DbGovernanceEvent; onClose: () => void }` |
| `AssetInspector` | `{ asset: DbGovernanceAsset; onClose: () => void; onChange: () => void; onSelect: (s: InspectorSelection) => void }` |
| `PolicyInspector` | `{ policy: DbGovernancePolicy; onClose: () => void; onChange: () => void }` |

### Hilfsfunktionen (nicht exportiert)

| Funktion | Signatur | Beschreibung |
|----------|----------|-------------|
| `RiskBadge` | `({ level: GovernanceRiskLevel })` | Farbkodiertes Badge für Risikostufen |
| `RiskScoreBadge` | `({ score: number })` | Numerisches Score-Badge (`0–100`) |
| `PolicyActionBadge` | `({ action: string })` | Farbkodiertes Badge für Policy-Aktionen |
| `MetaGrid` | `({ children })` | 2-spaltiges CSS-Grid für Metadaten |
| `MetaItem` | `({ icon, label, value, mono? })` | Einzelne Metadaten-Zeile mit Label und Wert |
| `Section` | `({ label, children })` | Abschnitts-Container mit Monospace-Label |
| `fmtDate` | `(iso: string) → string` | ISO-Datum → deutsches Format `TT.MM.JJ, HH:MM` |

---

## 3. Verwendungsbeispiele

### Grundintegration im Dashboard

```tsx
import { useState, useCallback } from 'react';
import {
  GovernanceInspectorPanel,
  type InspectorSelection,
} from './GovernanceInspectorPanel';

function MyDashboard() {
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const closeInspector = useCallback(() => setSelection(null), []);

  return (
    <>
      {/* Inhalte */}
      <EventList onRowClick={(ev) => setSelection({ type: 'event', item: ev })} />
      <AssetList onRowClick={(a)  => setSelection({ type: 'asset', item: a  })} />
      <PolicyList onRowClick={(p) => setSelection({ type: 'policy', item: p })} />

      {/* Inspector */}
      <GovernanceInspectorPanel
        selection={selection}
        onClose={closeInspector}
        onChange={reloadDashboard}
        onSelect={setSelection}
      />
    </>
  );
}
```

**Hinweis:** `onClose` sollte mit `useCallback` stabilisiert werden, damit der
`useEffect` für den Keyboard-Listener nicht bei jedem Render neu registriert wird.

### Ereignis-Zeile als Button

```tsx
<button
  onClick={() => onInspect({ type: 'event', item: ev })}
  className="w-full text-left border border-titanium-900 bg-obsidian-950/60 p-3
             hover:border-amber-500/40 transition-colors"
>
  <div className="font-semibold text-titanium-50 text-sm">{ev.title}</div>
  <div className="text-[11px] font-mono text-titanium-400 mt-1">
    {ev.event_type} · {ev.event_source}
  </div>
</button>
```

### Asset-Zeile mit separatem Archivieren-Button

Das `e.stopPropagation()` verhindert, dass der Archivieren-Button den Inspector öffnet:

```tsx
<li className="border border-titanium-900 bg-obsidian-950/60">
  <div className="flex items-stretch">
    {/* Klick öffnet Inspector */}
    <button onClick={onInspect} className="flex-1 min-w-0 p-3 text-left">
      <div className="font-semibold text-titanium-50 text-sm">{asset.name}</div>
    </button>

    {/* Archivieren-Button: stopPropagation schützt den Inspector-Trigger */}
    <button
      onClick={async (e) => {
        e.stopPropagation();
        await archiveAsset(asset.id);
        onChange();
      }}
      className="p-3 text-titanium-400 hover:text-titanium-100"
    >
      <Archive className="h-3.5 w-3.5" />
    </button>
  </div>
</li>
```

### Programmatisch zwischen Items wechseln

Der `onSelect`-Callback erlaubt dem Asset-Inspector, direkt in ein Ereignis zu
navigieren, ohne den Drawer zu schließen. Dies funktioniert durch Übergabe von
`setSelection` an `onSelect`:

```tsx
// Im Asset-Inspector: ein Ereignis anklicken wechselt die Ansicht
<button onClick={() => onSelect({ type: 'event', item: ev })}>
  {ev.title}
</button>
```

### Inspector programmatisch schließen

```tsx
// Nach einer Navigation
<Link
  to={`/governance/events/${event.id}`}
  onClick={onClose}  // schließt den Drawer vor der Navigation
>
  Vollansicht öffnen
</Link>
```

---

## 4. Keyboard Shortcuts

| Taste | Aktion | Voraussetzung |
|-------|--------|---------------|
| `Escape` | Schließt den Inspector | Inspector ist geöffnet (`selection !== null`) |

### Implementierung

Der Listener wird in einem `useEffect` registriert, der von `visible` (abgeleitet
aus `selection !== null`) und `onClose` abhängt:

```typescript
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
  if (visible) window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [visible, onClose]);
```

**Wichtig:** Der Listener wird nur registriert, wenn der Inspector sichtbar ist,
und beim Schließen zuverlässig wieder entfernt (Cleanup-Funktion). `onClose`
muss mit `useCallback` stabilisiert sein, sonst wird der Listener bei jedem
Render neu registriert.

### Erweiterbarkeit

Weitere Shortcuts lassen sich im selben `onKey`-Handler ergänzen, z. B.:

```typescript
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { onClose(); return; }
  // künftig: ArrowUp/ArrowDown für Item-Navigation
}
```

---

## 5. Testing Guide

### Unit-Tests (Vitest)

Datei: `test/components/governance/GovernanceInspectorPanel.test.tsx`

#### Vorbereitung

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  GovernanceInspectorPanel,
  type InspectorSelection,
} from '../../../src/features/governance/GovernanceInspectorPanel';

// Mocks für API-Aufrufe
vi.mock('../../../src/features/governance/governanceApi', () => ({
  fetchEvidenceForEvent: vi.fn().mockResolvedValue([]),
  fetchEventsForAsset:   vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../src/features/governance/resourcesApi', () => ({
  archiveAsset:  vi.fn().mockResolvedValue(undefined),
  togglePolicy:  vi.fn().mockResolvedValue(undefined),
}));

function renderPanel(selection: InspectorSelection | null, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <GovernanceInspectorPanel
        selection={selection}
        onClose={onClose}
        onChange={vi.fn()}
        onSelect={vi.fn()}
      />
    </MemoryRouter>
  );
}
```

#### Testfälle

**Drawer geschlossen wenn `selection === null`**

```typescript
it('ist nicht sichtbar wenn selection null ist', () => {
  renderPanel(null);
  // Panel im DOM (für Animation), aber außerhalb des Viewports
  const aside = screen.getByRole('complementary', { name: /inspector/i });
  expect(aside.className).toContain('translate-x-full');
});
```

**Event-Inspector rendert korrekte Felder**

```typescript
it('zeigt Titel und Risikostufe des Ereignisses', () => {
  const event = buildMockEvent({ title: 'GDPR-Verstoß erkannt', risk_level: 'high' });
  renderPanel({ type: 'event', item: event });
  expect(screen.getByText('GDPR-Verstoß erkannt')).toBeInTheDocument();
  expect(screen.getByText('high')).toBeInTheDocument();
});
```

**ESC schließt den Inspector**

```typescript
it('ruft onClose bei Escape-Taste auf', () => {
  const onClose = vi.fn();
  const event = buildMockEvent();
  renderPanel({ type: 'event', item: event }, onClose);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledOnce();
});
```

**Backdrop-Klick schließt den Inspector**

```typescript
it('ruft onClose beim Klick auf Backdrop auf', () => {
  const onClose = vi.fn();
  renderPanel({ type: 'event', item: buildMockEvent() }, onClose);
  fireEvent.click(document.querySelector('[aria-hidden="true"]')!);
  expect(onClose).toHaveBeenCalledOnce();
});
```

**Policy-Toggle ruft `togglePolicy` auf**

```typescript
it('toggled Policy-Status beim Klick auf Toggle-Button', async () => {
  const { togglePolicy } = await import('../../../src/features/governance/resourcesApi');
  const policy = buildMockPolicy({ id: 'pol-1', enabled: true });
  renderPanel({ type: 'policy', item: policy });
  fireEvent.click(screen.getByRole('button', { name: /pausieren/i }));
  await waitFor(() => expect(togglePolicy).toHaveBeenCalledWith('pol-1', false));
});
```

**Archivieren-Knopf im Asset-Inspector**

```typescript
it('archiviert Asset nach Bestätigung', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const { archiveAsset } = await import('../../../src/features/governance/resourcesApi');
  const asset = buildMockAsset({ id: 'ast-1', status: 'active' });
  renderPanel({ type: 'asset', item: asset });
  fireEvent.click(screen.getByLabelText(/archivieren/i));  // falls aria-label gesetzt
  await waitFor(() => expect(archiveAsset).toHaveBeenCalledWith('ast-1'));
});
```

**Wechsel vom Asset- in den Event-Inspector**

```typescript
it('wechselt in Event-Inspector beim Klick auf verknüpftes Ereignis', async () => {
  const { fetchEventsForAsset } = await import('../../../src/features/governance/governanceApi');
  const linkedEvent = buildMockEvent({ title: 'Verknüpftes Ereignis' });
  (fetchEventsForAsset as Mock).mockResolvedValue([linkedEvent]);
  const onSelect = vi.fn();
  const asset = buildMockAsset();
  render(
    <MemoryRouter>
      <GovernanceInspectorPanel
        selection={{ type: 'asset', item: asset }}
        onClose={vi.fn()} onChange={vi.fn()} onSelect={onSelect}
      />
    </MemoryRouter>
  );
  await screen.findByText('Verknüpftes Ereignis');
  fireEvent.click(screen.getByText('Verknüpftes Ereignis'));
  expect(onSelect).toHaveBeenCalledWith({ type: 'event', item: linkedEvent });
});
```

#### Test-Fixtures

```typescript
import type { DbGovernanceEvent, DbGovernanceAsset, DbGovernancePolicy } from
  '../../../src/features/governance/governanceApi';

function buildMockEvent(overrides: Partial<DbGovernanceEvent> = {}): DbGovernanceEvent {
  return {
    id: 'evt-test-1',
    tenant_id: 'tenant-1',
    asset_id: null,
    policy_id: null,
    event_type: 'data_transfer',
    event_source: 'sdk',
    title: 'Test-Ereignis',
    summary: null,
    risk_level: 'medium',
    actor_email: null,
    vendor: null,
    model_name: null,
    data_types: [],
    policy_action: null,
    payload: {},
    created_at: '2026-06-05T10:00:00Z',
    ...overrides,
  };
}

function buildMockAsset(overrides: Partial<DbGovernanceAsset> = {}): DbGovernanceAsset {
  return {
    id: 'ast-test-1',
    tenant_id: 'tenant-1',
    asset_type: 'ai_system',
    name: 'Test-Asset',
    description: null,
    owner_email: null,
    vendor: null,
    system_url: null,
    data_types: [],
    risk_score: 45,
    ai_act_class: 'limited',
    status: 'active',
    metadata: {},
    created_at: '2026-06-01T08:00:00Z',
    updated_at: '2026-06-05T10:00:00Z',
    ...overrides,
  };
}

function buildMockPolicy(overrides: Partial<DbGovernancePolicy> = {}): DbGovernancePolicy {
  return {
    id: 'pol-test-1',
    tenant_id: 'tenant-1',
    name: 'Test-Policy',
    description: null,
    policy_type: 'model_usage',
    severity: 'medium',
    action: 'warn',
    condition: {},
    enabled: true,
    created_at: '2026-06-01T08:00:00Z',
    updated_at: '2026-06-05T10:00:00Z',
    ...overrides,
  };
}
```

### E2E-Tests (Playwright)

Datei: `e2e/governance/inspector-panel.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Governance Inspector Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/websites');
    // Warten bis Dashboard geladen ist
    await page.waitForSelector('[data-testid="governance-event-row"]');
  });

  test('öffnet Event-Inspector per Klick auf Ereignis-Zeile', async ({ page }) => {
    await page.click('[data-testid="governance-event-row"]:first-child');
    await expect(page.locator('[aria-label="Inspector"]')).toBeVisible();
    await expect(page.locator('[aria-label="Inspector"]')).not.toHaveClass(/translate-x-full/);
  });

  test('schließt Inspector per ESC-Taste', async ({ page }) => {
    await page.click('[data-testid="governance-event-row"]:first-child');
    await page.keyboard.press('Escape');
    await expect(page.locator('[aria-label="Inspector"]')).toHaveClass(/translate-x-full/);
  });

  test('schließt Inspector per Backdrop-Klick', async ({ page }) => {
    await page.click('[data-testid="governance-event-row"]:first-child');
    // Klick auf Backdrop (links neben dem Drawer)
    await page.click('[aria-hidden="true"]');
    await expect(page.locator('[aria-label="Inspector"]')).toHaveClass(/translate-x-full/);
  });

  test('wechselt Inhalt beim Klick auf anderen Eintrag', async ({ page }) => {
    const rows = page.locator('[data-testid="governance-event-row"]');
    const firstTitle  = await rows.nth(0).locator('.font-semibold').innerText();
    const secondTitle = await rows.nth(1).locator('.font-semibold').innerText();

    await rows.nth(0).click();
    await expect(page.locator('[aria-label="Inspector"] h2')).toHaveText(firstTitle);

    await rows.nth(1).click();
    await expect(page.locator('[aria-label="Inspector"] h2')).toHaveText(secondTitle);
  });

  test('navigiert zur Vollansicht per Link', async ({ page }) => {
    await page.click('[data-testid="governance-event-row"]:first-child');
    await page.click('text=Vollansicht öffnen');
    await expect(page).toHaveURL(/\/governance\/events\/.+/);
  });

  test('Policy-Toggle ändert Status ohne Inspector zu schließen', async ({ page }) => {
    await page.click('[data-testid="governance-policy-row"]:first-child');
    const toggleBtn = page.locator('[aria-label="Inspector"] button', { hasText: /pausieren|aktivieren/i });
    await toggleBtn.click();
    // Inspector bleibt offen
    await expect(page.locator('[aria-label="Inspector"]')).toBeVisible();
  });
});
```

### Manuelle Checkliste

Vor jedem Release sollte der Inspector manuell gegen die folgenden Szenarien
geprüft werden:

- [ ] Klick auf Ereignis-Zeile → Event-Inspector öffnet sich mit korrekten Metadaten
- [ ] Klick auf Asset-Zeile → Asset-Inspector zeigt letzte Ereignisse; Klick auf Ereignis wechselt den Inspector-Inhalt (Drawer bleibt offen)
- [ ] Klick auf Policy-Zeile → Policy-Inspector; Toggle-Button ändert Status, Inspector schließt sich nicht
- [ ] `ESC` schließt den Inspector
- [ ] Klick auf Backdrop schließt den Inspector
- [ ] Archivieren-Button in Asset-Zeile öffnet keinen Inspector (stopPropagation funktioniert)
- [ ] Archivieren-Button im Asset-Inspector öffnet Bestätigungsdialog, archiviert danach und schließt den Drawer
- [ ] „Vollansicht öffnen"-Link navigiert zur Detail-Route und schließt den Inspector
- [ ] Payload-JSON im Event-Inspector ist auf- und zuklappbar (`max-h-48`)
- [ ] Condition-JSON im Policy-Inspector ist auf- und zuklappbar (`max-h-40`)
- [ ] Bei Asset ohne verknüpfte Ereignisse erscheint der Abschnitt „Letzte Ereignisse" nicht
- [ ] Evidence-Abschnitt erscheint nur wenn Einträge vorhanden sind
- [ ] Inspector erscheint auf mobilen Breiten korrekt (kein horizontales Überlaufen)
- [ ] `npm run lint` bleibt fehlerfrei
- [ ] `npm test` bleibt fehlerfrei (1452+ Tests grün)

---

*Zuletzt aktualisiert: 2026-06-05*
