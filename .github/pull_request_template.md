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

## Produkt- und Infrastrukturabnahme

Bei Produkt-, Landing- oder Plattformänderungen gilt die [RealSync-Infrastrukturregel 2027](RealSync_Infrastrukturregel_2027.md).
Für jeden Punkt Nachweis oder begründetes „nicht betroffen“ angeben; offene Prüfungen bleiben offen.

- [ ] Produktkatalog, direkte Zielroute und Kundenweg bis Einrichtung/Dashboard geprüft.
- [ ] Gemeinsames weißes Design, konsistente SYNC-Figur, Mobilansicht und Medien-Fallbacks geprüft.
- [ ] Zentrale Anmeldung, Mandant, Rollen und serverseitige Produktberechtigung nachgewiesen; gemeinsame Dienste wiederverwendet.
- [ ] Produktstatus und Tarif mit maßgeblichen Quellen abgeglichen; externe Integrationen und kostenpflichtige Aktionen separat nachgewiesen.

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
