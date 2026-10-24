## PR-Triage-Policy (verbindlich)

Gilt für jede Session, die offene PRs in diesem Repo mergt, schließt, rebased oder neu anlegt.

### Einzel-Freigabe durch Dominik — immer, ohne Ausnahme
- Security-PRs
- Migrationen (nie gebündelt, nie parallel zu offenen Rebases)
- Schließen eines PRs, erst nach Prüfung, ob der Inhalt bereits in `main` steckt.
  Als Einzel-Freigabe gilt: Der PR steht als eigene Zeile in der freigegebenen Triage-Liste. Eine pauschale Freigabe für eine ganze Phase reicht dafür nicht.
- Preise, Steuer- und Rechtstexte, Claims auf der Landing
- Rebase oder Force-Push („Update branch“ per Merge ist kein Rebase). Dazu zählen auch `npm run sync:main` (rebased, `--push` = force-with-lease) und `git rebase --onto` bei gestapelten PRs.
- Produktionsdeploy. Die Merge-Freigabe ist keine Deploy-Freigabe. Solange ein Merge automatisch deployt (Pages, Supabase, VPS, Workers; siehe `docs/claude/DEPLOYMENT_GOVERNANCE_PLAN.md`), braucht der Merge eines PRs mit solchen Pfaden zusätzlich die Deploy-Freigabe in seiner Zeile (Spalte `Deploy`).
- Änderungen an Deploy-Workflows, Environments, Branch-Schutz, Auto-Merge oder Secret-Zugriff sowie jeder Dispatch eines Deploy-, Migrations- oder Lösch-Workflows

Alles andere darf phasenweise gebündelt werden, nachdem die Phasenliste freigegeben ist.

### Merge-Voraussetzungen
Eine Merge-Freigabe gilt nur für einen PR, der auf `main` zielt, kein Draft ist und auf dem aktuellen Head volle CI hat (u. a. `ci.yml`, CodeQL, Merge Hygiene). Diese Workflows laufen nur für PRs gegen `main`.
Das Label `automerge` ersetzt keine Freigabe. Agenten setzen es nicht. Für Security-PRs, Migrationen und PRs mit automatischer Produktionswirkung ist es ausgeschlossen.

### Security-PRs haben Vorrang
Als Security-PR gilt jeder PR mit mindestens einem dieser Merkmale:
- Label `security` oder ein Titel mit `fix(security)` bzw. `feat(security)`
- er behebt einen CodeQL-Befund
- er ist ein Dependabot-Security-Update
- er ändert Auth, RLS-Policies, Secrets oder Keys
- er ändert Autorisierung, Policy-Entscheidungen, Tool-Rechte, Kill-Switch, Einwilligung oder Session-Bindung (z. B. Voice-Runtime)
- er behebt eine bestätigte Sicherheitslücke, auch außerhalb der genannten Bereiche (z. B. XSS, SSRF, unsichere Dateiverarbeitung, Kryptografie), unabhängig von Titel oder Label

Die Liste ist nicht abschließend. Im Zweifel gilt ein PR als Security-PR.
Agenten kennzeichnen Security-PRs mit `fix(security)`/`feat(security)` im Titel oder dem Label `security`.

Security-PRs werden vor allen anderen Phasen vorgelegt und warten nicht auf ihre Phase.

### Reihenfolge
Security (vorgezogen) → Fixes/CI → Legal/Pricing → Landing → Features → Migrationen (zuletzt, einzeln).
Ausnahme: Eine Migration, die Teil eines Security-PRs ist (z. B. RLS-Härtung), läuft mit dem Security-PR vorgezogen, bleibt aber einzeln und nie parallel zu anderen Migrationen.
PRs, die eine Hotspot-Datei ändern, werden seriell gemergt, nie parallel.

### Konflikt-PRs
Ein Konflikt allein ist kein Schließgrund.

1. Fällt der PR in eine Einzel-Freigabe-Kategorie, entscheidet Dominik. Die folgenden Schritte liefern dann nur den Vorschlag für die Liste.
2. Normaler Konflikt: `main` in den Branch mergen, Lockfiles und generierte Dateien mit den Repo-Tools neu erzeugen, CI laufen lassen, pushen.
3. Hotspot-Konflikt: erst den Inhalt gegen `main` prüfen.
   - Schon in `main` oder überholt → schließen, mit einem Satz Begründung
   - Noch nötig, aber veraltet oder vermischt → schließen und einen kleinen neuen PR vom aktuellen `main` anlegen, der auf den alten verweist
   - Noch nötig und sauber isolierbar → behalten und den Konflikt auflösen

**Hotspot** = `src/App.tsx`, Hero- und Landing-Komponenten sowie jede Datei, die in den letzten 30 Tagen in mehr als 5 gemergten PRs geändert wurde. Ausgenommen sind Lockfiles und generierte Dateien, die werden nach Schritt 2 neu erzeugt. Diese Liste wird zu Beginn jeder Triage-Welle neu erzeugt. „Hotspot“ ist der einzige maßgebliche Begriff; ein Label wie `hot-file` ist nur ein Hinweis.

**Überholt** heißt auch: `main` löst dasselbe Problem anders, zum Beispiel mit neuen Design-Tokens statt altem Styling.

**Gemischter Fall** (Hotspot plus normale Dateien) → Hotspot-Pfad.

Die statische Liste in `scripts/lib/merge-playbook.mjs` nennt noch `MainLanding.tsx`. Bis sie korrigiert ist, gelten die Datei aus `<Route path="/">` in `src/App.tsx` und `src/components/landing/**` nach der Definition oben als Hotspot.

### Gestapelte PRs
Ein PR darf auf dem Branch eines anderen offenen PRs aufbauen, wenn beide dieselben Dateien ändern müssen. Die Beschreibung nennt Basis-PR und Basis-Commit. Gemergt wird in der Reihenfolge des Stapels.
Nach dem Squash-Merge des Basis-PRs: `origin/main` in den Folge-Branch mergen, Konflikte lösen, normal pushen, dann die Basis des PRs auf `main` umstellen. Das ist kein Rebase. `git rebase --onto` braucht eine Einzel-Freigabe.
Vorher gilt keine Merge-Freigabe, weil `ci.yml`, CodeQL und Merge Hygiene erst nach dem Umstellen laufen.

### Ablauf jeder Welle
1. Liste an Dominik: `#Nr | Konflikt | Hotspot | Security | Deploy | Weg | ein Satz Begründung`, Security-PRs zuerst. `Deploy` nennt die Produktionssysteme, die der Merge heute automatisch auslöst.
2. Ausführen erst nach seinem OK
3. Jeder geschlossene PR bekommt eine Begründung im PR, jeder Ersatz-PR verweist auf den alten.

### Feste Produktentscheidungen (Stand 27.09.2026)
- **Enterprise-Preis:** 1.249 € ist die höchste Stufe und die einzige Quelle. Eine Stufe „Enterprise Plus“ gibt es nicht. README, Pricing und Landing weichen nicht ab. Im Pricing-Hinweis steht: „Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.“ Die Angleichung von README und Pricing kommt als eigener PR in der Phase Legal/Pricing.
- **Landing-Basis (aktualisiert 10.10.2026, Dateiangabe 24.10.2026):** Maßgeblich ist das Element von `<Route path="/">` in `src/App.tsx` (Stand 24.10.2026: `src/pages/LandingV6.tsx`; am 10.10. war es `LandingV4.tsx`). Frontend und Landingpage gezielt verbessern. Die jeweils auf `/` gerenderte Fassung ist der aktuelle Ausgangspunkt, kein Selbstzweck: Sie darf angepasst oder ersetzt werden, wenn die Änderung nachvollziehbare Vorteile bei Verständlichkeit, Bedienbarkeit, Barrierefreiheit, Performance oder technischer Wartbarkeit bringt. Bestehende Funktionen erhalten und Änderungen gegen den aktuellen Stand prüfen. Frühere Designfassungen sind keine verbindliche Vorlage. Merge und Deploy benötigen weiterhin eine separate Freigabe. Design-, Hero- und Landing-Änderungen erfolgen als kleine, prüfbare Folge-PRs gegen den aktuellen `main`.
- **Kein Restaurant- oder branchenfremder Scope im Kernprodukt.** Bots und Agenten gehören nur als abgegrenztes Modul, als Demo oder als separate App auf die Governance-Infrastruktur.
- **WIP-Stopp:** Solange mehr als 20 PRs offen sind, werden keine neuen Feature-PRs angelegt, auch nicht von Agenten oder Copilot. Ausgenommen sind Triage-, Ersatz-, Security- und Docs-PRs zur Umsetzung dieser Policy.
