# RealSync MCP Governance Server

Geplante Zugriffsschicht, über die KI-Agenten Compliance-Nachweise lesen können —
nachvollziehbar, mandantengetrennt, widerrufbar.

> ## ⛔ Nicht betriebsbereit — nicht deployen
>
> Der Dienst **verweigert derzeit jeden Zugriff mit 401**. Das ist Absicht: Es
> gibt keinen Key-Speicher, also niemanden, dessen Berechtigung sich feststellen
> ließe. Bis die Key-Verwaltung nachgezogen ist, kann der Server nichts
> ausliefern, wofür er einstehen könnte.
>
> Er ist entsprechend **nirgends deployt** (keine Referenz in `docker/`,
> `deploy/`, `infra/`, `.github/`) und soll es bis dahin auch nicht werden.

---

## Was fehlt, bevor der Dienst nutzbar ist

| Baustein | Stand |
|---|---|
| Key-Speicher (Tabelle, Ausstellung, Widerruf, Ablauf) | fehlt |
| Scope-Durchsetzung | `requireScope` existiert als preHandler, ist aber an keine Route gebunden — ohne echte Scopes hätte er nichts zu prüfen |
| Prüfpfad | `services/audit.ts` schreibt auf die Konsole und sonst nirgendwohin |
| Governance-Werkzeuge | drei Endpunkte antworten mit **501** |
| Plan-Gate / Kontingent | fehlt |
| MCP-Protokoll | fehlt — Anbindung wäre nur über HTTP möglich |

---

## Was funktioniert

Die Evidence-Endpunkte fragen `evidence_snapshots` korrekt und
mandantengefiltert ab. Sie sind nur nicht erreichbar, solange die
Authentifizierung verweigert.

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/health` | ohne Key erreichbar |
| `GET` | `/evidence` | Snapshots des Tenants |
| `GET` | `/evidence/:id` | einzelner Snapshot |
| `POST` | `/evidence/:id/verify-hash` | prüft nur, ob Hashwerte vorhanden sind — **verfolgt die Kette nicht** |
| `GET` | `/evidence/control/:controlId` | Textabgleich über `subject_ref`, keine Bedeutungssuche |

Die Governance-Endpunkte (`/governance/status`, `/governance/controls`,
`/governance/controls/:id/compliance`) antworten mit **501 Not Implemented**
samt Begründung. Sie liefern bewusst keine Null-Werte: ein Agent würde
`score: 0` sonst als Befund „nicht konform" weiterreichen, obwohl nie etwas
gemessen wurde.

---

## Entwicklung

```bash
cd apps/mcp-server
npm install
npm run dev         # Port 3001
npm run build
npm run typecheck
```

```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"…"}
```

| Variable | Zweck |
|---|---|
| `SUPABASE_URL` | Projekt-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | nur hier, nie im Client |
| `PORT` / `HOST` | Standard `3001` / `0.0.0.0` |

Der Server bricht beim Start ab, wenn die Datenbank nicht erreichbar ist —
besser ein sofortiger Fehlstart als ein Dienst, der Anfragen annimmt und nichts
liefern kann.

---

## Architekturprinzipien

- **Nur lesend.** Kein Endpunkt verändert Governance-Daten.
- **Kein Service-Role-Key im Client.** Er liegt ausschließlich hier im Server;
  der Browser spricht nie mit diesem Dienst.
- **Fail closed.** Was sich nicht prüfen lässt, wird verweigert — nicht gewährt.
