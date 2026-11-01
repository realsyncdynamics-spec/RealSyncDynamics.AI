---
description: WP7a SSoT-Bereinigung — SCIM/On-Prem streichen (E-V7), SSO als Preview auf Anfrage (E-V8), Hostinger-Roadmap streichen (E-V9), Bot-Laufzeit und PLANS-Export prüfen
---

# WP7a — SSoT-Bereinigung (E-V7, E-V8, E-V9)

> **Stand:** 2026-11-01 · Repo-Messung 01.11. 18:3x: `main@dbbd8a4` unverändert, 34 offene PRs (WIP-Stopp aktiv) · Basis: E-V7, E-V8, E-V9 (entschieden 2026-11-01, Dominik Steiner), Fundstellen gemessen gegen `main@dbbd8a4`.
> Ersetzt den Auftrag aus dem geschlossenen #1752. **Nicht** aus #1752 übernehmen, sondern diese Fassung nutzen.

Du arbeitest an **WP7a SSoT-Bereinigung** aus `.claude/os-funnel/PLAN.md` (§3 Nachtrag 2026-10-04, §4).
Ein Branch, ein PR. **Nur Repo.** Kein Deploy, kein Merge, kein Push auf `main`.

---

## Vor dem Start (Pflicht)

1. In `PLAN.md` §3 müssen E-V7, E-V8 und E-V9 als **entschieden** stehen (Text siehe unten). Fehlt das, zuerst den PLAN-Patch als eigenen Commit in diesem Branch einfügen und im PR-Text nennen.
2. Offene PRs zählen. Bei **> 20 → stopp** (WIP-Policy), keinen Branch anlegen.
3. `main` neu messen. Alle Fundstellen unten per `rg` bestätigen. Weicht `main` von `dbbd8a4` ab, Abweichungen im PR-Text nennen.
4. Pfade mit `(?)` im Repo auflösen. Lässt sich ein Teil nicht eindeutig zuordnen: **diesen Teil weglassen** und im PR-Text als offen melden. Nicht raten.

---

## Umfang

### A — E-V7: SCIM und On-Prem streichen

```bash
rg -n -i "scim|on-prem|on-premise|onprem" src shared public --glob '!**/node_modules/**'
```

| Fundstelle (Stand `dbbd8a4`) | Aktion |
|---|---|
| `EnterpriseKonfigurator.tsx` (SCIM) | Option/Text entfernen |
| `runtimeVocab.ts` (SCIM) | Eintrag entfernen; Verwendungen prüfen, kein toter Verweis |
| `TenantAdminConsole.tsx` (SCIM) | Entfernen. Ist es ein deaktivierter UI-Platzhalter ohne Claim, im PR-Text begründen, falls er bleibt |
| `GovernanceFooter.tsx` („SSO, On-Prem, Custom-DPA…“) | „On-Prem“ streichen. SSO-Wording nach E-V8 (siehe B) |
| `src/config/seo.ts` (Branchen-Texte „On-Premise-Option“) | Satzteil streichen, Satz grammatisch reparieren, keine neue Aussage |

Treffer in ADRs, Changelogs oder Tests, die nur **historisch** dokumentieren, bleiben. Im PR-Text als „bewusst nicht“ aufführen.

### B — E-V8: Enterprise-SSO = „Single Sign-On (Preview, auf Anfrage)“

```bash
rg -n "enterprise-sso|Single Sign-On|\bSSO\b" src shared docs/adr --glob '!**/node_modules/**'
```

| Fundstelle | Aktion |
|---|---|
| `implementation-status.ts`, `implementation-status-public.ts` (`enterprise-sso`) | Status `coming-soon` → `preview` |
| `src/config/pricing.ts` (Katalog) | Label „Single Sign-On (Preview, auf Anfrage)“ |
| Landing v7 (Komponente `(?)`) | Label angleichen. **Nur Text, keine Tokens** (Design-Freeze) |
| `GovernanceFooter.tsx` | SSO-Nennung mit „(Preview, auf Anfrage)“ oder entfernen, falls dort kein Platz für die Einschränkung ist |
| ADR 0007 | Status-Abschnitt nachziehen: Preview auf Anfrage, kein Self-Service-Build. Datei liegt unter `docs/` → **Budget prüfen** (`npm run check:context`). Nur ändern, nicht vergrößern |

Kein Wort wie „verfügbar“, „inklusive“ oder „integriert“ für SSO.

### C — E-V9: Roadmap-Eintrag `agent-os-hostinger-workers` streichen

```bash
rg -n "agent-os-hostinger-workers|hostinger" src shared test --glob '!**/node_modules/**'
```

| Fundstelle | Aktion |
|---|---|
| `implementation-status.ts`, `implementation-status-public.ts` | Eintrag entfernen |
| `agent-os-slice.test.ts` | Erwartung anpassen (Eintrag fehlt). Nicht den Test löschen |

Andere Hostinger-Treffer (Mail, `SubProcessors.tsx`) **nicht anfassen** — das hängt an E-V5/E-V6, die offen sind.

### D — Bot-Laufzeit: eine Wahrheit `(?)`

Ziel laut PLAN: Die Bot-Laufzeit (Kontingent/Dauer je Plan) steht genau an **einer** Stelle im SSoT (`shared/pricing.ts` oder `platform-capabilities.ts`), alle anderen Stellen lesen von dort.

- Zuerst messen: `rg -n -i "bot.*(laufzeit|runtime|minuten|stunden)|botRuntime|botHours" src shared`
- Gibt es zwei unterschiedliche Werte für denselben Plan: **stopp für Teil D**, Befund im PR-Text melden. Welcher Wert gilt, ist eine Preis-/Katalogentscheidung (Owner).
- Sind die Werte gleich, aber doppelt gepflegt: auf eine Quelle umstellen, Werte unverändert.

### E — Toter `PLANS`-Export `(?)`

- `rg -n "\bPLANS\b" src shared test`
- Hat der Export **keine** Verwendung außer Re-Exporten: entfernen.
- Hat er Verwendungen: auf den SSoT umstellen, Werte unverändert. Ist das nicht trivial, Teil E weglassen und melden.

---

## Ausdrücklich nicht in diesem PR

- Preise, Plan-Zuschnitt, Kontingentwerte (auch nicht „nebenbei“)
- Enterprise 1.498 € (läuft über #1995/#1999)
- „SLA & dedizierter Tenant“ (separater offener Claim-Punkt)
- `eu_local`, Sub-Prozessoren, Hostinger-Mail (E-V5, E-V6 offen)
- Design-Tokens, Landing-Layout, 3D (E-V4)
- Stripe, Supabase, Cloudflare, Secrets

---

## Prüfung

`npm run lint` · `npm test` (mindestens `agent-os-slice`, Pricing- und Implementation-Status-Suites) · `npm run check:pricing` · `npm run check:offer-prices` · `npm run check:landing-claims` · `npm run check:fabrication` · `npm run check:context` · `npm run build`

Nach dem Fix gegenprüfen, dass diese Suchen leer sind (außer bewusst begründeten Treffern):

```bash
rg -n -i "scim|on-prem" src shared public
rg -n "agent-os-hostinger-workers" src shared test
```

---

## PR-Text (Definition of Done)

```
WP7a – SSoT-Bereinigung (E-V7, E-V8, E-V9)

Basis: E-V7/E-V8/E-V9 entschieden 2026-11-01 (Dominik Steiner), gemessen gegen main@<hash>

A  E-V7 SCIM/On-Prem gestrichen: <Fundstellen, je geändert / bewusst nicht + Grund>
B  E-V8 SSO → „Single Sign-On (Preview, auf Anfrage)“, Status coming-soon → preview: <Fundstellen>
C  E-V9 agent-os-hostinger-workers gestrichen: <Fundstellen>
D  Bot-Laufzeit: <umgestellt / gestoppt mit Befund>
E  PLANS-Export: <entfernt / umgestellt / weggelassen mit Grund>

Aufgelöste (?)-Pfade: …
Nicht angefasst: Preise, Enterprise 1.498 €, Sub-Prozessoren (E-V5/E-V6), Tokens.

Live: —
Preview: Single Sign-On (auf Anfrage) — neu als preview gekennzeichnet
Coming Soon: —

Checks: lint · test (…) · check:pricing · check:offer-prices · check:landing-claims · check:fabrication · check:context · build
```

---

## PLAN.md-Patch (falls noch nicht auf `main`)

In §3, Tabelle „Nachtrag 2026-10-04“, die drei Zeilen ersetzen:

| ID | Frage | Status / Entscheidung | Begründung |
|---|---|---|---|
| **E-V7** | On-Prem / SCIM | ✅ **Entschieden 2026-11-01 (Dominik Steiner): streichen.** Umsetzung WP7a. | SCIM nicht gebaut (ADR 0008), On-Prem in keinem Plan. |
| **E-V8** | Enterprise-SSO im Katalog | ✅ **Entschieden 2026-11-01 (Dominik Steiner): „Single Sign-On (Preview, auf Anfrage)“**, Status `preview`. Umsetzung WP7a, ADR 0007 nachziehen. | SSO ist Vorschau, kein Self-Service-Build. |
| **E-V9** | Roadmap-Eintrag `agent-os-hostinger-workers` | ✅ **Entschieden 2026-11-01 (Dominik Steiner): streichen.** Umsetzung WP7a. | VPS ist ausgelaufen; Produktion = Cloudflare + Supabase. |

In §4, Zeile WP7a: „⏳ Offen … Teile warten auf E-V7–E-V9“ ersetzen durch
„► **Entsperrt (2026-11-01).** Auftrag `.claude/commands/wp7a-ssot-cleanup.md` (Neufassung, ersetzt #1752).“
