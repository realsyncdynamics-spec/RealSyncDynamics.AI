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

## Warum `.mcp.json` leer ist

Am 2026-09-15 auf Entscheidung des Eigentümers geleert. Vorher waren acht
MCP-Server registriert: `perplexity-mcp` und sieben Hostinger-Server
(`hosting`, `domains`, `dns`, `billing`, `reach`, `vps`, `ecommerce`).

Der Grund ist Kosten, nicht Qualität: Die Werkzeugbeschreibungen eines
MCP-Servers liegen in **jeder einzelnen Anfrage** im Kontext — nicht einmal je
Sitzung, wie `CLAUDE.md`. Acht Server mit zusammen rund 200 Werkzeugen waren
damit der größte Einzelposten am Tokenverbrauch, größer als die ungekürzte
`CLAUDE.md` je war.

**Nichts ist verloren.** Der Code von `perplexity-mcp` liegt weiterhin unter
`services/perplexity-mcp/`; die Hostinger-Server kommen aus dem npm-Paket
`hostinger-api-mcp`. Ein Server lässt sich jederzeit einzeln zurückholen — die
vollständige frühere Fassung dieser Datei steht in der Git-History:

```bash
git log --oneline -- .mcp.json          # Commit vor der Leerung finden
git show <commit>:.mcp.json             # frühere Registrierung ansehen
```

**Regel für die Rückkehr**: einzeln eintragen, nicht wieder alle acht — und nur
den Server, für den es eine laufende Aufgabe gibt. `npm run check:context` weist
ab fünf Servern wieder auf die Kosten hin.
