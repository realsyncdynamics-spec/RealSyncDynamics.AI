# Merge-Konflikt-Konzept

Verbindliche Betriebsregel für `main` auf GitHub. Ziel: Konflikte früh sichtbar machen, linear mergen, Hot-Files serialisieren. Nicht: Konflikte im Browser „wegklicken“.

## 1. Entscheidung

| Regel | Wert | Warum |
|---|---|---|
| Geschichte | linear, **Squash-only** | Ein Commit pro PR, Rebase bleibt trivial |
| Integration | Feature-Branch → PR → `main` | Kein Direkt-Push auf `main` |
| Aktualisieren | **Rebase auf `origin/main`** | Keine Merge-Commits im Feature-Branch |
| Race | **Merge Queue** für `main` | Zwei grüne PRs können sich nicht gegenseitig schmutzig mergen |
| Lockfiles | nie textuell mergen | `npm install` erzeugt die Wahrheit |
| Migrationen | append-only, eindeutiger Timestamp | Prod-DB ist ein Log, kein Diff |

`scripts/release-merge-deploy.sh` bleibt Notfall-Lokalpfad (`--no-ff`). Der Standardweg ist GitHub Squash + Queue.

## 2. Verhindern, bevor es kracht

1. Branch Lebensdauer kurz. Liegt ein PR >2 Tage hinter `main`, ist Rebase Pflicht, nicht optional.
2. Ein PR = ein Zweck. Keine „nebenbei CLAUDE.md + App.tsx + Pricing + Migration“.
3. **Hot-Files** nicht parallel anfassen. Wer `src/App.tsx`, `shared/pricing.ts` oder eine Migration braucht, prüft offene PRs zuerst (`hot-file`-Label).
4. Täglich: `npm run sync:main` auf dem eigenen Branch.
5. Draft-PR sofort nach dem ersten pushbaren Stand — CI und Hygiene laufen, solange der Branch noch weich ist.

### Hot-Files

Diese Dateien erzeugen historisch die Konflikte (siehe `IMPLEMENTATION_SPEC.md`):

- `src/App.tsx` — jede neue Route
- `index.html`
- `shared/pricing.ts` / `src/config/pricing.ts`
- `supabase/migrations/*.sql`
- `package-lock.json` / `package.json`
- `CLAUDE.md`
- `src/index.css`, `src/pages/MainLanding.tsx` (Design-Lock)
- `src/features/governance/dashboard/FreeTierDashboard.tsx`

Neue öffentliche Route: bestehenden Import-/Route-Block **additiv** erweitern, keine Umsortierung „zur Ordnung“.

## 3. GitHub-Einstellungen (einmalig, Owner)

Settings → General → Pull Requests:

- [x] Allow squash merging (einzige Methode)
- [ ] Allow merge commits
- [ ] Allow rebase merging
- [x] Always suggest updating pull request branches
- [x] Allow auto-merge
- [x] Automatically delete head branches

Settings → Branches → `main` (Ruleset, nicht die alte Protection-UI):

- [x] Restrict updates; bypass nur Owner für Hotfix
- [x] Require a pull request · 1 Review · dismiss stale reviews
- [x] Require status checks **and** require branches to be up to date
- Required checks: `build`, `Migration validation`, `Merge Hygiene / conflict-state`, `Merge Hygiene / hygiene`
- [x] Require merge queue · 1 PR im Queue-Merge · fail the job → raus aus der Queue
- [ ] Allow force pushes
- [ ] Allow deletions

Required checks erst aufnehmen, wenn der Workflow auf `main` mindestens einmal grün war. Sonst blockiert ein toter Checknamen jeden Merge.

```bash
# Kontrolle, kein stiller Rewrite der History
gh repo edit --enable-squash-merge --disable-merge-commit --disable-rebase-merge \
  --delete-branch-on-merge --enable-auto-merge
```

Merge Queue schaltet CI zusätzlich mit `merge_group` — deshalb hören `ci.yml` und dieser Hygiene-Workflow auf `merge_group`.

## 4. Ablauf pro PR

```
feat/<slug> anlegen
        ↓
arbeiten, klein committen
        ↓
npm run sync:main          # rebase auf origin/main
        ↓
npm run lint && npm test
        ↓
npm run merge:hygiene      # Migration + Hot-Files
        ↓
Draft-PR → Review → Ready
        ↓
auto-merge + Queue
        ↓
squash auf main → Deploy
```

Nach jedem Merge eines **anderen** PRs, der ein Hot-File teilt: sofort `npm run sync:main -- --push`.

## 5. Konflikt lösen — festes Playbook

Nicht im GitHub-Web-Editor. Nicht `git merge origin/main` in den Feature-Branch.

```bash
npm run sync:main
# bei Konflikten: Datei nach Tabelle unten lösen
git add <datei>
git rebase --continue
npm run lint && npm test
npm run sync:main -- --push          # --force-with-lease, sonst nichts
```

Abbruch: `npm run sync:main -- --abort`

| Dateityp | Auflösung |
|---|---|
| `supabase/migrations/*.sql` | Inhalt der **neuen** Datei behalten. Timestamp kollidiert → `npm run migrate:rename -- <datei>`. Datei, die schon auf `main` liegt, nicht editieren. |
| `package-lock.json` | Konflikt verwerfen, `npm install`, Lockfile neu adden. |
| `package.json` | Beide Dependency-Änderungen bewusst vereinen, dann Lockfile neu. |
| `src/App.tsx` | Beide neuen Routes/Imports behalten. Keine öffentliche Route umbiegen. |
| `shared/pricing.ts` | Nur diese Datei ist Quelle. Danach `npm run sync:pricing && npm run check:pricing`. |
| `MainLanding.tsx` / `src/index.css` | Design-Lock. Nur eigene Inhalts-Hunks. Optik nur mit Freigabe (CLAUDE.md §10). |
| `CLAUDE.md` | Ist-Zustand **nach** dem Merge beschreiben, keine zwei Zwischenstände kleben. |

Zwei gleichzeitige Migrationen mit gleichem Timestamp: der **neuere** PR benennt um. Der ältere behält den Namen.

## 6. Automation im Repo

| Baustein | Aufgabe |
|---|---|
| `.github/workflows/merge-hygiene.yml` | Label `conflicts` / `needs-rebase` / `hot-file`, Kommentar, harter Fail bei Migrations-Kollision |
| `npm run merge:hygiene` | dieselben Checks lokal |
| `npm run sync:main` | Rebase + optionales `--push` |
| `npm run migrate:rename` | Timestamp anheben |
| `.gitattributes` | Lockfile nicht textuell auto-mergen |
| `.github/CODEOWNERS` | Review auf Hot-Files |
| `.github/pull_request_template.md` | Merge-Checkliste am PR |

`conflicts` auf einem PR ist ein Blocker, kein Hinweis. Der Autor rebased, nicht der Reviewer.

## 7. Merge-Reihenfolge bei mehreren offenen PRs

1. Blocker/Hotfix zuerst (`[hotfix]` nur für nie angewendete Migrationen).
2. PRs ohne Hot-Files.
3. PRs mit geteiltem Hot-File **serial** — einer durch die Queue, die anderen rebasen.
4. Große Umbauten (`platform/`, Routing-Schnitt) zuletzt.
5. Nach jeder Stufe: `npm run lint && npm test` auf `main` muss grün sein, bevor die nächste Stufe startet.

Das ist dieselbe Logik wie in `IMPLEMENTATION_SPEC.md` §4, nur dauerhaft statt einmalig.

## 8. Was dieses Konzept bewusst nicht tut

- Kein automatisches Rebase durch einen Bot auf den Feature-Branch (force-push fremder Branches).
- Kein `git merge -X ours` auf Anwendungscode.
- Kein Umbau von `src/App.tsx` in dieser Änderung. Ein Route-Register wäre die strukturelle Lösung gegen den häufigsten Konflikt — eigene Entscheidung, eigener PR.

## 9. Definition of Done für „mergebar“

- Branch = `origin/main` + PR-Diff, Test-Merge konfliktfrei
- Hygiene-Job grün (keine Timestamp-Kollision, keine editierte Main-Migration)
- `build` + `Migration validation` grün
- Hot-File-Kollision entweder weg oder bewusst nach dem anderen PR gerebased
- Squash über die Merge Queue, nicht per Direkt-Push
