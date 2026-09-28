## PR-Triage-Policy (verbindlich)

Gilt für jede Session, die offene PRs in diesem Repo mergt, schließt, rebased oder neu anlegt.

### Einzel-Freigabe durch Dominik — immer, ohne Ausnahme
- Security-PRs
- Migrationen (nie gebündelt, nie parallel zu offenen Rebases)
- Schließen eines PRs, erst nach Prüfung, ob der Inhalt bereits in `main` steckt.
  Als Einzel-Freigabe gilt: Der PR steht als eigene Zeile in der freigegebenen Triage-Liste. Eine pauschale Freigabe für eine ganze Phase reicht dafür nicht.
- Preise, Steuer- und Rechtstexte, Claims auf der Landing
- Rebase oder Force-Push („Update branch“ per Merge ist kein Rebase)

Alles andere darf phasenweise gebündelt werden, nachdem die Phasenliste freigegeben ist.

### Security-PRs haben Vorrang
Als Security-PR gilt jeder PR mit mindestens einem dieser Merkmale:
- Label `security` oder ein Titel mit `fix(security)` bzw. `feat(security)`
- er behebt einen CodeQL-Befund
- er ist ein Dependabot-Security-Update
- er ändert Auth, RLS-Policies, Secrets oder Keys
- er behebt eine bestätigte Sicherheitslücke, auch außerhalb der genannten Bereiche (z. B. XSS, SSRF, unsichere Dateiverarbeitung, Kryptografie), unabhängig von Titel oder Label

Die Liste ist nicht abschließend. Im Zweifel gilt ein PR als Security-PR.

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

### Ablauf jeder Welle
1. Liste an Dominik: `#Nr | Konflikt | Hotspot | Security | Weg | ein Satz Begründung`, Security-PRs zuerst
2. Ausführen erst nach seinem OK
3. Jeder geschlossene PR bekommt eine Begründung im PR, jeder Ersatz-PR verweist auf den alten.

### Feste Produktentscheidungen (Stand 27.09.2026)
- **Enterprise-Preis:** 1.249 € ist die höchste Stufe und die einzige Quelle. Eine Stufe „Enterprise Plus“ gibt es nicht. README, Pricing und Landing weichen nicht ab. Im Pricing-Hinweis steht: „Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.“ Die Angleichung von README und Pricing kommt als eigener PR in der Phase Legal/Pricing.
- **Landing-Basis:** Seit #1686 ist `src/pages/LandingV2.tsx` die kanonische Startseite auf `/`. Frühere Landing-Fassungen unter `/design/*` sind nur reversible Referenzen und keine Designvorgabe für `/`. Design-, Hero- und Landing-PRs werden nicht pauschal zusammengeführt; Änderungen erfolgen als kleine Folge-PRs gegen den aktuellen `main`.
- **Kein Restaurant- oder branchenfremder Scope im Kernprodukt.** Bots und Agenten gehören nur als abgegrenztes Modul, als Demo oder als separate App auf die Governance-Infrastruktur.
- **WIP-Stopp:** Solange mehr als 20 PRs offen sind, werden keine neuen Feature-PRs angelegt, auch nicht von Agenten oder Copilot. Ausgenommen sind Triage-, Ersatz-, Security- und Docs-PRs zur Umsetzung dieser Policy.
