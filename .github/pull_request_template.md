## Änderung

<!-- Ein Zweck. Keine opportunistischen Extra-Dateien. Gestapelt? Basis-PR und Basis-Commit nennen. -->

## Typ

- [ ] `feat` · [ ] `fix` · [ ] `refactor` · [ ] `chore` · [ ] Security-PR (`fix(security)`/`feat(security)` oder Label `security`)

## Merge-Bereitschaft

- [ ] Branch per Merge auf aktuelles `origin/main` gebracht (kein Rebase ohne Einzel-Freigabe)
- [ ] Basis ist `main`, kein Draft, volle CI auf dem aktuellen Head grün
- [ ] `npm run merge:hygiene` ohne Blocker
- [ ] Keine bestehende Datei unter `supabase/migrations/` geändert (außer Titel `[hotfix]`)
- [ ] Neue Migration: Timestamp nach der letzten Datei auf `main`
- [ ] `package.json` geändert ⇒ `package-lock.json` mitcommitet
- [ ] `shared/pricing.ts` geändert ⇒ `npm run sync:pricing && npm run check:pricing`
- [ ] Keine parallele Arbeit an denselben Hot-Files wie ein älterer offener PR

## Nachweise

| Befehl | Umgebung | Ergebnis | vollständig / `TEILWEISE` |
|---|---|---|---|
| | | | |

<!-- Nur ausgeführte Prüfungen. Gefilterter Typecheck, Stubs, fehlende oder andere Paketversionen = TEILWEISE. -->

## Deploy-Wirkung

<!-- Welche Systeme deployt der Merge automatisch? Pages / Supabase DB / Edge Functions / VPS-Runtime / Workers / keine.
     Solange das automatisch passiert, braucht der Merge zusätzlich eine Deploy-Freigabe. -->

## Risiko

- [ ] öffentliche Route / `src/App.tsx`
- [ ] Migration / RLS
- [ ] Auth / Policy / Tool-Rechte / Session
- [ ] Pricing / Entitlements
- [ ] Design-Lock (Landing auf `/` laut `src/App.tsx`, `src/index.css`) — nur mit Freigabe

Freigaben: `.github/PR_TRIAGE_POLICY.md` · Playbook: `docs/MERGE_CONFLICT_CONCEPT.md`
