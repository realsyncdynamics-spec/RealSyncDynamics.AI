---
name: aios-dashboard-review
description: AI-OS Development Agent — eine App-Fläche prüfen: echte Datenquellen, Empty/Fehler-Zustände, funktionierende Bedienelemente, Barrierefreiheit, Responsivität.
---

# Dashboard Quality Review

**Agent:** Development · **Rechte:** `github.contents.read`

## Eingaben
- `route` (Pflicht): z. B. `/app/dashboard`, `/admin/ai-os`

## Ablauf
1. Komponente über `src/App.tsx` finden; Datenquellen je Element notieren.
2. Jede Zahl auf Quelle zurückführen; `npm run check:fabrication` und `npm run check:dashboard`.
3. Zustände prüfen: lädt · leer · Fehler · keine Berechtigung · nicht konfiguriert.
4. Jeder Button: echte Aktion oder ehrlich als Vorschau beschriftet und deaktiviert.
5. Barrierefreiheit: Fokus, Beschriftungen, Kontrast in Hell- und Dunkelmodus.
6. Responsiv bei 375 px, 768 px, 1280 px (Playwright-Screenshot, falls verfügbar).

## Ausgaben
- `report`: Element · Quelle · Zustände · Befund · Fix

## Qualität
- Keine Fake-KPIs; fehlende Quelle = Empty State oder Vorschau-Label.
