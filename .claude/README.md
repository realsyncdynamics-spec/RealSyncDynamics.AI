# `.claude/` — Sitzungskonfiguration

## Warum hier Lesesperren stehen

`permissions.deny` in `settings.json` sperrt das **Lesen** von Dateien, deren
Inhalt für keine Entscheidung gebraucht wird, deren Umfang aber sofort den
halben Sitzungskontext füllt:

| Gesperrt | Größe | Stattdessen |
|---|---|---|
| `package-lock.json` (6 ×, Root + Services) | zus. ~650 KB (~185.000 Tokens) | `package.json`, oder `npm ls <paket>` |
| `**/*.generated.ts` | `pricing.generated.ts` allein 111 KB | die Quelle `shared/pricing.ts` |
| `dist/`, `coverage/`, `playwright-report/`, `test-results/` | Buildausgabe | den Quelltext bzw. die Zusammenfassung des Laufs |

Die Sperre gilt für das Read-Werkzeug. Über die Shell (`cat`, `sed`) sind die
Dateien weiterhin erreichbar — das ist Absicht: Ein gezieltes `grep` in einer
Lockdatei ist billig und manchmal nötig, sie ganz zu lesen ist es nie.

## Budget

`context-budget.json` ist die Ratsche gegen still wachsenden Sitzungskontext,
geprüft von `npm run check:context`. Hintergrund: `CLAUDE.md` §0.
