# @realsync/browser-guardian

Policy Engine, Freigaben, Nachweise und Executor-Tor für Browser-Agenten.
Abhängigkeitsfrei (WebCrypto); läuft in Node 22, Browser und Deno.

- `policy.ts` — reine Entscheidung `allow · require_approval · deny` nach
  Ziel, Daten, Kontext und Wirkung. Unbekanntes ⇒ deny, kein `log_only`.
- `classify.ts` — Datenklassen; Inhaltserkennung verschärft nur.
- `approval.ts` — HMAC-gebundene, einmalige Freigaben, höchstens 15 min.
- `evidence.ts` — gekettetes Protokoll mit Richtlinienversion.
- `guardian.ts` — bewertet bei Ausführung neu, verbraucht Freigaben, prüft
  das tatsächliche Ergebnis; hält die Sitzung an, wenn kein Nachweis
  geschrieben werden kann.
- `simulation.ts` — Treiber ohne Browser (nur Tests/`--simulate`).

Tests: `node --test test/features/governance/browser-guardian/*.test.ts`
(laufen auch unter `npm test`).
