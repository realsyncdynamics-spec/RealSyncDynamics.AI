# Onboarding-Funnel — Ist-Zustand (Phase 0)

**Gemessen am 2026-09-08** auf `main` @ `9587905`.

---

## 1. Der Zielfunnel des Auftrags (§7, §26)

```
Landing → Domain → FREE SCAN → Ergebnis → Konto → Workspace
        → 14-TAGE-TRIAL → /assistant → Nutzung → Paket
```

---

## 2. Was davon bereits steht

| Schritt | Stand | Beleg |
|---|---|---|
| Landing mit Domain-Eingabe | **`LIVE`** | Freigabe 2026-08-23, Scan-Formular zuerst im Hero |
| Kanonischer Scan-Einstieg | **`LIVE`** — `/audit` | `App.tsx:536`; `/scan` leitet dorthin (`:503`) |
| Free Scan ohne Konto | **`LIVE`** | `/audit` ohne `AppGate` |
| Ergebnisseite | **`LIVE`** | `/audit/result/:auditId`, `/audit/share/:token` |
| Konto anlegen | **`LIVE`** | `/welcome` (`App.tsx:609`) |
| Registrierung auf `/welcome` gebündelt | **`LIVE`** | Freigabe 2026-09-01 |
| Profil bei Anmeldung | **`LIVE` seit 2026-09-06** | `20260906200000_profiles_on_signup` |
| 14-Tage-Trial | **`LIVE` in der Quelle** | `trialDays: 14` auf Starter und Growth |
| Nach der Kasse ins Dashboard | **`LIVE`** | Freigabe 2026-09-01, `/checkout/success` → `/app/dashboard` |

**Der Funnel ist in weiten Teilen gebaut.** Der Auftrag beschreibt ihn als zu
entwerfen; gemessen fehlen nicht die Schritte, sondern ihre Verbindung.

---

## 3. Der Befund: die Anmeldung mit Google/Microsoft/GitHub

§26 verlangt „Preferred: Google · Microsoft · GitHub". Gemessen in
`src/features/auth/OAuthProviderButtons.tsx`:

| Provider | Zustand |
|---|---|
| Google | Flag `VITE_AUTH_GOOGLE_ENABLED` (opt-out) |
| Microsoft (`azure`) | Flag `VITE_AUTH_AZURE_ENABLED` — **opt-IN, standardmäßig aus** |
| GitHub | Flag `VITE_AUTH_GITHUB_ENABLED` — **opt-IN, standardmäßig aus** |
| LinkedIn | Flag, opt-IN |

Der Grund steht im Kopf der Datei und ist **am Live-Projekt gemessen, nicht
vermutet**: Bei GitHub und Facebook ist in Supabase eine **Google-Client-ID**
hinterlegt (`1036000996285-….apps.googleusercontent.com`). Eine Google-ID
funktioniert weder bei `github.com` noch bei `login.microsoftonline.com` — wer
klickt, landet auf einer Fehlerseite. Die Schalter stehen also **absichtlich**
aus.

> **Das ist ein Betreiberschritt, kein Code-Befund.** Die richtigen Client-IDs
> und Secrets gehören in die Supabase-Auth-Konfiguration; nach CLAUDE.md §4
> dürfen sie nicht ins Repo. Solange sie fehlen, ist §26 („Preferred: Google ·
> Microsoft · GitHub") **nicht** erfüllbar, und zwar unabhängig davon, wie viel
> Frontend gebaut wird.

Vorbildlich ist der Umgang damit: Die Knöpfe werden **ausgeblendet** statt
angeboten. §14 der CLAUDE.md verlangt genau das — kein Element vortäuschen, das
nichts tut.

---

## 4. Der Konflikt: drei offene PRs bauen denselben Einstieg um

| PR | Ändert |
|---|---|
| #1236 | P0-Journey: Taxonomie, Zahlungs-Wiederherstellung, Einstieg für Bestandskunden |
| #1227 | Onboarding-Einstieg in den geführten `/flow`-Ablauf |
| #1257 | `/unified-entry/transformation` fragt „Was möchtest du bauen?" |

Jeder für sich ist plausibel. Zusammen ergeben sie **drei** Einstiege statt
einem — genau das, was §0 des Auftrags verhindern soll.

**Empfehlung**: Diese drei vor dem Merge gegeneinander entscheiden. Es ist der
einzige Konflikt in diesem Dokument, der aktiv größer wird, solange niemand
entscheidet.

---

## 5. Offene Punkte

| Punkt | Status |
|---|---|
| Verbraucht der Free Scan bezahlte Kontingente? (§26) | **`UNKNOWN`** — nicht gemessen |
| Hat der Trial einen eigenen Entitlement-Zustand? | **`UNKNOWN`** — `trialDays` ist gesetzt, die Laufzeitwirkung nicht geprüft |
| Was passiert nach Trial-Ende? | **`UNKNOWN`** |
| Erreicht der Funnel den Trial überhaupt? | **`UNKNOWN`** |
| Mandantenkontext von `/assistant` | **`UNKNOWN`** — siehe `dashboard-consolidation.md` §3 |

Die erste Frage ist die wichtigste: Ein Free Scan, der bezahlte Kontingente
verbraucht, wäre ein direkter Umsatzschaden — und er wäre still, weil niemand
ihn bemerkt, solange die Zahl nicht ausgelesen wird.

---

## 6. Empfehlung

1. **Funnel-Dreieck entscheiden** (#1236 / #1227 / #1257) — vor jedem Merge.
2. **OAuth-Client-IDs setzen** — Betreiberschritt, schaltet §26 frei.
3. **Die fünf `UNKNOWN` messen**, beginnend mit dem Free-Scan-Verbrauch.
4. **Nichts neu bauen**, was in §2 als `LIVE` steht.
