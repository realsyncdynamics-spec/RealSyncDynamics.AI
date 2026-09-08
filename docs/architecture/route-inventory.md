# Route-Inventar (Phase 0)

**Gemessen am 2026-09-08** aus `src/App.tsx` auf `main` @ `9587905`:
`grep -oE 'path="[^"]*"' src/App.tsx | sort -u`.

| Kennzahl | Wert |
|---|---|
| Eindeutige Routen | **480** |
| Weiterleitungen (`Navigate to=`) | 48 |
| `AppGate`-geschützt | 56 |
| in `GovernanceBrowserShell` | 129 |
| Seiten in `src/pages/` | 114 |
| Dashboard-artige Dateien | 47 |

> **Lesart**: `AppGate` (56) und `GovernanceBrowserShell` (129) sind Zählungen
> der Vorkommen im Quelltext, nicht der geschützten Routen — eine Route kann
> beides tragen, und die Wrapper stehen teils verschachtelt. Die Zahl der
> tatsächlich auth-gated Routen ist damit **UNKNOWN** und in Phase 0 nicht
> aufgelöst. Sie gehört vor Phase 3 gemessen: eine ungeschützte `/app/*`-Route
> wäre ein Sicherheitsbefund, kein Kosmetikfehler.

---

## 1. Verteilung nach oberstem Segment

| Segment | Routen |
|---|---|
| `/app` | 138 |
| `/governance` | 26 |
| `/os` | 23 |
| `/tools` | 13 |
| `/optimizer` | 11 |
| `/unified-entry` | 10 |
| `/legal` | 9 |
| `/operations` | 8 |
| `/admin` | 8 |
| `/settings` | 7 |
| `/finance` | 7 |
| `/dashboard` | 6 |
| `/claude-code-optimizer` | 5 |
| `/demo-tour` | 4 |
| `/pricing` | 3 |
| `/integrations` | 3 |
| `/checkout` | 3 |
| `/audit` | 3 |
| `/tenant` | 2 |
| `/solutions` | 2 |
| `/shopify` | 2 |
| `/scan` | 2 |

Die drei größten Blöcke tragen zusammen 187 der 480 Routen: `/app` (138),
`/governance` (26), `/os` (23).

---

## 2. Mehrfache Einstiege in denselben Zweck

Das ist der Kern des Konsolidierungsbefunds — gemessen, nicht geschätzt.

### 2.1 Anmeldung und Registrierung — 11 Einstiege

`/login` · `/signup` · `/register` · `/welcome` · `/os/login` · `/os/signup` ·
`/os/welcome` · `/unified-entry/register` · `/demo-login` · `/demo-tour/signup`

CLAUDE.md §10 (Freigabe 2026-09-01) hat `/unified-entry/register` bereits auf
`/welcome?next=…` gelegt und `/flow/login` auf `/welcome` — die Konsolidierung
ist begonnen, aber nicht abgeschlossen. `/os/login` und `/os/signup` bleiben
laut derselben Freigabe „bestehen und erreichbar, nur kein Ziel des Flows mehr".

### 2.2 Scan und Audit — 11 Einstiege

`/audit` · `/scan` · `/scan/start` · `/unified-entry/scan` · `/optimizer/scan` ·
`/claude-code-optimizer/scan` · `/os/audit` · `/audit-pro` · `/marisk-audit` ·
`/cookie-scanner` · `/tools/cookie-scanner`

Der kanonische ist seit der Freigabe vom 2026-08-23 (2) **`/audit`**
(`App.tsx:536`, rendert `AuditLanding`); die Startseite zeigt dorthin.

`/scan` ist **bereits eine Weiterleitung** dorthin (`App.tsx:503`,
`<Navigate to="/audit" replace />`) — der Schnitt aus PR #1129 ist also
erfolgt, und zwar richtig: als Redirect, nicht als Löschung, wie es
CLAUDE.md §12 für öffentliche Route-Contracts verlangt. Von den elf Einstiegen
sind damit mindestens zwei bereits konsolidiert.

### 2.3 Preise — 6 · Kasse — 6

Preise: `/pricing` · `/pricing/:slug` · `/pricing/whatsapp` · `/os/pricing` ·
`/optimizer/pricing` · `/governance-os-pricing`

Kasse: `/checkout/:planKey` · `/checkout/success` · `/checkout/cancelled` ·
`/os/checkout` · `/optimizer/checkout` · `/demo-tour/checkout`

Zwei Kassen neben der kanonischen (`/os/`, `/optimizer/`) sind ein
Umsatzpfad-Risiko: Sie können auf einen anderen Preisstand zeigen als
`shared/pricing.ts`. **In Phase 0 nicht geprüft — `UNKNOWN`, und der Prüfung
wert.**

### 2.4 Die Parallelwelt `/os/*` — 23 Routen

Eigene Anmeldung, eigene Preisseite, eigene Kasse, dazu `/os/app/*` mit 12
Routen (`websites`, `risks`, `compliance`, `evidence`, `monitoring`,
`ai-usecases`, `agents`, `reports`, `team`, `billing`, `settings`).

Seit der Freigabe vom 2026-09-01 stehen die `/os/app/*`-Routen hinter
`AppGate`. Ob dieser Zweig ein eigenes Produkt, ein Altbestand oder eine
Testfläche ist, ist **`UNKNOWN`** und eine Eigentümerfrage.

---

## 3. Der Alias-Präzedenzfall

`src/App.tsx:603–604`:

```tsx
<Route path="/command-center"    element={<Navigate to="/assistant" replace />} />
<Route path="/ai-command-center" element={<Navigate to="/assistant" replace />} />
```

Die in §25 des Auftrags verlangte Mechanik ist im Repo bereits erprobt. Für
`/app/dashboard` und `/app/intelligence` ist sie nur nie angewandt worden.

---

## 4. Zielmodell (Vorschlag, nicht umgesetzt)

| Kanonisch | Alias (Weiterleitung) |
|---|---|
| `/assistant` | `/app/dashboard`, `/app/intelligence`, `/command-center`, `/ai-command-center` |
| `/audit` | `/scan`, `/unified-entry/scan`, `/os/audit` |
| `/welcome` | `/login`, `/signup`, `/register`, `/os/login`, `/os/signup` |
| `/pricing` | `/os/pricing`, `/optimizer/pricing` |
| `/checkout/:planKey` | `/os/checkout`, `/optimizer/checkout` |

**Bedingung aus CLAUDE.md §12**: Öffentliche Route-Contracts dürfen nicht
brechen. Weiterleitungen sind erlaubt, URL-Änderungen nicht — jede Alias-Zeile
braucht einen Test, sonst entstehen tote Links in Suchindex und Kundenmails.
