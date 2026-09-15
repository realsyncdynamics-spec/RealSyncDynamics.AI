# `.claude/` — Sitzungskonfiguration

## Warum hier Lesesperren stehen

`permissions.deny` in `settings.json` sperrt das **Lesen** von Dateien, deren
Inhalt für keine Entscheidung gebraucht wird, deren Umfang aber sofort den
halben Sitzungskontext füllt:

| Gesperrt | Größe | Stattdessen |
|---|---|---|
| `package-lock.json` (Root + Services/Apps) | zus. ~700 KB (~200k Tokens) | `package.json`, oder `npm ls <paket>` |
| `**/*.generated.ts` | `pricing.generated.ts` allein ~112 KB | Quelle `shared/pricing.ts` |
| `dist/`, `coverage/`, `playwright-report/`, `test-results/` | Buildausgabe | Quelltext bzw. Lauf-Zusammenfassung |
| `.archive/**` (u. a. `root-docs/`: 57 alte Root-Status-/Phase-Dokumente) | ~820 KB (~235k Tokens) | gezieltes `rg` in `.archive/root-docs/` |

Die Sperre gilt für das Read-Werkzeug. Über die Shell (`rg`, gezieltes `sed`)
bleiben die Dateien erreichbar — Absicht: ein gezieltes Grep in einer Lockdatei
ist billig, sie ganz zu lesen nie.

## Budget

`context-budget.json` ist die Ratsche gegen still wachsenden Sitzungskontext,
geprüft von `npm run check:context` in CI. Wächst `CLAUDE.md` oder `.claude/`,
auslagern — Budget nicht anheben.

## Hooks

`hooks/session-start.sh` darf **kein** `npm install` ausführen (Cloud-Timeout
+ Kontextmüll). Nur `exit 0`.
