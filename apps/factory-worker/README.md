# SF-002 – isolierter Read-only-Verifikationsworker

**Prototyp. Nicht deployt.** Keine GitHub-Schreibrechte, keine LLM-Ausführung, kein REA/MCP, keine Kundendaten und keine Supabase-Secrets. Der Worker führt nur fest definierte Prüfungen gegen einen bereits geprüften Checkout aus. Er schreibt keinen Code, erstellt keine PRs und ersetzt kein Governance-Gateway.

## Auftragsformat

Die ausschließlich erlaubten JSON-Felder: `version`, `jobId`, `commitSha`, `step`, `maxDurationMs`.

| `step` | Tätigkeit | Voraussetzung |
|---|---|---|
| `worker-self-test` | Node-Bordmitteltests des Workers | keine npm-Abhängigkeiten |
| `factory-core-test` | Vitest `test/factory/state-machine.test.ts` | geprüfte, vorher bereitgestellte `node_modules` |
| `project-typecheck` | TypeScript `--noEmit` | geprüfte, vorher bereitgestellte `node_modules` |

Beliebige Befehle, Argumente oder Pfade sind verboten. Der Commit muss als vollständiger 40-stelliger Hash einem Detached HEAD entsprechen. Stderr/stdout werden nicht als Klartext weitergegeben; der Worker gibt Exit-Code, Dauer, Bytezahl und Prüfsummen als JSON aus.

## Lokale Probe auf einem getrennten Docker-Host

Die Befehle sind **Anweisungen für einen späteren manuellen Test**, nicht bereits hier ausgeführte Maßnahmen. Voraussetzung ist ein vertrauenswürdiger Checkout mit dem neuen SF-002-Code.

```bash
# Im RealSync-Checkout mit dem SF-002-Branch:
node --test apps/factory-worker/test/worker.test.mjs
docker build --pull=false -f apps/factory-worker/Dockerfile -t rsd-factory-worker:sf002 .

STAGE="$(mktemp -d)"
git clone --no-checkout --filter=blob:none \
  https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git "$STAGE/repo"
git -C "$STAGE/repo" fetch origin refs/heads/factory/sf-001-foundation-20261120
APPROVED_SHA="$(git -C "$STAGE/repo" rev-parse FETCH_HEAD)"
git -C "$STAGE/repo" checkout --detach "$APPROVED_SHA"
chmod 755 "$STAGE" "$STAGE/repo"
printf '{"version":1,"jobId":"SF-002-smoke","commitSha":"%s","step":"worker-self-test","maxDurationMs":30000}\n' "$APPROVED_SHA" > "$STAGE/job.json"
chmod 644 "$STAGE/job.json"

docker run --rm \
  --network none --read-only --user 10001:10001 \
  --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 64 --cpus 1 --memory 1024m \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --mount "type=bind,src=$STAGE/repo,dst=/workspace,readonly" \
  --mount "type=bind,src=$STAGE/job.json,dst=/input/job.json,readonly" \
  rsd-factory-worker:sf002

# Nach Sichtung der Ergebnisse: STAGE manuell entfernen.
```

**Wichtig:** Beim produktiven Einsatz muss der Owner den gewünschten Commit-SHA unabhängig prüfen, die Basis-Image-Version per Digest pinnen und die Docker-Umgebung härten. Der vorstehende Befehl darf keine Secrets, Docker-Sockets oder weiteren Hostpfade erhalten. Das Repository ist nur lesbar eingebunden. Entkoppelte GitHub-Checkout-Vorbereitung ist Aufgabe eines späteren autorisierten Orchestrators.

## Grenzen

Der Worker schützt **nicht** selbst vor beliebigem Programmcode im Repository: Tests und Build-Werkzeuge können innerhalb des Containers weitere Prozesse ausführen. Deshalb niemals unmittelbar mit privilegiertem Docker-Daemon, Produktion oder fremdem ungeprüftem Code betreiben. Container-Sicherheit, Rootless-Engine, restriktive Seccomp-/AppArmor-Profile, attestierte Images, Negative-E2E und Audit-/Budget-Integration müssen vor jedem echten Betrieb separat abgenommen werden.

Laufzeitbegrenzung: 1–300 Sekunden; Ausgangsdaten maximal 256 KiB. Erlaubt sind nur die drei festen Schritte, keine freien Flags. Der Eingabemanifest ist **keine Autorisierung**. Serverbasierte Identitäts-, Mandanten-, Zweck- und Freigabeprüfung fehlt noch.
