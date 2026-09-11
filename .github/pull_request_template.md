## Änderung

<!-- Ein Zweck. Keine opportunistischen Extra-Dateien. -->

## Typ

- [ ] `feat` · [ ] `fix` · [ ] `refactor` · [ ] `chore`

## Merge-Bereitschaft

- [ ] `npm run sync:main` gegen aktuelles `origin/main` ausgeführt
- [ ] `npm run merge:hygiene` ohne Blocker
- [ ] `npm run lint` und `npm test` grün
- [ ] Keine bestehende Datei unter `supabase/migrations/` geändert (außer Titel `[hotfix]`)
- [ ] Neue Migration: Timestamp nach der letzten Datei auf `main`
- [ ] `package.json` geändert ⇒ `package-lock.json` mitcommitet
- [ ] `shared/pricing.ts` geändert ⇒ `npm run sync:pricing && npm run check:pricing`
- [ ] Keine parallele Arbeit an denselben Hot-Files wie ein älterer offener PR

## Risiko

- [ ] öffentliche Route / `src/App.tsx`
- [ ] Migration / RLS
- [ ] Pricing / Entitlements
- [ ] Design-Lock (`MainLanding.tsx`, `src/index.css`) — nur mit Freigabe

Playbook: `docs/MERGE_CONFLICT_CONCEPT.md`
