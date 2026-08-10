# 17 — Production Readiness

## 1. Gesamturteil

> **RealSyncDynamicsAI ist in seinem heutigen Produktionszustand nicht bereit,
> als EU-SaaS-Governance-Plattform mit echten Kundendaten zu betrieben zu werden.**

Nicht weil die Substanz fehlt — sie ist überwiegend vorhanden und teils
überdurchschnittlich gebaut — sondern weil **47 % davon nicht deployt ist** und die
Authentifizierungsschicht der Edge Functions lückenhaft bleibt.

---

## 2. Repo-Stand vs. Produktionsstand

| Ebene | Repository | Produktion |
|---|---|---|
| Edge Functions | 178 | **95** (83 fehlen) |
| Migrationen | 270 | Teilmenge (118 offen laut Runbook) |
| Kern-Tabellen | vollständig | **12+ fehlen**, u. a. `entitlement_grants`, `audit_jobs`, `governance_memory`, `evidence_vault_items`, `policy_pack_catalog` |
| Frontend | 119 Seiten | ✅ deployt |
| Typecheck | ✅ grün | — |
| Unit-Tests | ✅ 2867 grün | — |
| DB-/E2E-Tests | vorhanden | **laufen nie** |

Die Modul-Prozentangaben in `CLAUDE.md` (Audit 95 %, Policy Packs 100 %,
Evidence Vault 90 %, Governance Runtime 85 %, Provenance 80 %) beschreiben den
**Repo-Stand**. Die Datei warnt selbst korrekt davor — die Modul-Liste darunter
wiederholt die Zahlen aber ungefiltert (F-30).

---

## 3. Modul-Status in Produktion

| Modul | Repo | Produktion | Status |
|---|---|---|---|
| Audit / DSGVO-Scan | 95 % | `audit_jobs` fehlt | 🟠 **teilweise** |
| Policy Packs | 100 % | Function + Tabelle fehlen | ⚫ **nicht verfügbar** |
| Evidence Vault | 90 % | Function + Tabelle fehlen | ⚫ **nicht verfügbar** |
| Governance Runtime | 85 % | Chain ✅, Incidents ❌, Scheduler ❌ | 🟠 **teilweise** |
| Provenance / C2PA | 80 % | beide Functions fehlen | ⚫ **nicht verfügbar** |
| Memory Governance (RFC-003) | 100 % | 3 Functions + Tabelle fehlen | ⚫ **nicht verfügbar** |
| ISO 42001 | vollständig | alles fehlt | ⚫ **nicht verfügbar** |
| SiteOS | Phase 1 | 3 Functions fehlen | ⚫ **nicht verfügbar** |
| Öffentliche API | vollständig | fehlt | ⚫ **nicht verfügbar** |
| Webhooks | vollständig | fehlt | ⚫ **nicht verfügbar** |
| Scheduler / Automation | vollständig | fehlt | ⚫ **nicht verfügbar** |
| White Label | vollständig | fehlt | ⚫ **nicht verfügbar** |
| Partner Mode | vollständig | fehlt | ⚫ **nicht verfügbar** |
| Billing (Abos) | vollständig | Webhook + Checkout + Portal ✅ | 🟢 **funktionsfähig** |
| Billing (Einmalprodukt) | vollständig | `entitlement_grants` fehlt | 🔴 **kaputt** |
| Auth / Multi-Tenancy | vollständig | RLS trägt, Functions lückenhaft | 🟠 **teilweise** |
| Human Oversight / Approvals | vollständig | deployt | 🟢 **funktionsfähig** |
| DSR / Betroffenenrechte | vollständig | deployt | 🟢 **funktionsfähig** |
| Prüfpfad / Hash-Chain | vollständig | deployt | 🟢 **funktionsfähig** |

Legende: 🟢 verifiziert · 🟠 teilweise · 🔴 kaputt · ⚫ beworben, in Produktion nicht vorhanden

---

## 4. Go-Live-Kriterien

### Blocker (P0 — zwingend vor jedem Kundenzugang)
- [ ] **F-04** Auth-Bypass in 6 Functions schließen — **vor** dem Deploy der 83
- [ ] **F-05** 18 Functions ohne Auth absichern; `enterprise-ai-os-discovery-pending`
      sofort abschalten oder absichern (LIVE)
- [ ] **F-02** Migrations-Ledger reconcilen (Runbook `p0-2`)
- [ ] **F-01** 83 Functions deployen — **erst danach**
- [ ] **F-03** `entitlement_grants` anwenden oder Einmalprodukt deaktivieren

### Schwerwiegend (P1 — vor Enterprise-/Kanzlei-Kunden)
- [ ] **F-08** RLS auf 35 Tabellen
- [ ] **F-09** 3 Policies auf `TO service_role` einschränken
- [ ] **F-06** Drift-Guard ohne Credentials auf `exit 1`
- [ ] **F-07** `test:db` + E2E in CI
- [ ] **F-G1/F-G2** Löschpfad vervollständigen, Account-Löschung bauen
- [ ] **F-R1** Retry/DLQ/Webhook-Zustellung in Produktion
- [ ] **F-10** Externe Verankerung — **oder** Claims „unveränderlich/revisionssicher"
      zurücknehmen

### Wichtig (P2)
- [ ] Website-Claims an die Produktionsrealität angleichen (`02_CLAIMS_REALITY_MATRIX.md`)
- [ ] F-12 Abhängigkeiten aktualisieren · F-14 CSP ohne `unsafe-inline`
- [ ] F-15 CORS-Allowlist · F-16 `search_path` pinnen · F-17 Bundle
- [ ] F-13 `vercel.json` entfernen · F-20 `.sql.bak` entfernen
- [ ] F-R3 Alarmierung für Auth-/Billing-/Evidenz-Fehler

---

## 5. Realistischer Zeitrahmen

Bei einem fokussierten Team:

| Phase | Inhalt | Aufwand |
|---|---|---|
| 1 | P0-Sicherheit (F-04, F-05) — einheitlicher Auth-Helfer + Umbau von 24 Functions | 3–5 Tage |
| 2 | Migrations-Reconciliation + vollständiger Function-Deploy (F-01, F-02, F-03) | 2–4 Tage, riskant, Rollback-Plan nötig |
| 3 | RLS-Lücken + Policies (F-08, F-09) | 2–3 Tage |
| 4 | CI-Härtung (F-06, F-07) | 1 Tag — **größter Hebel pro Aufwand** |
| 5 | Reliability + DSGVO-Löschpfade | 5–8 Tage |
| 6 | Claims-Angleichung + P2 | 3–5 Tage |

**Go-live 2026-08-01 ist bereits verstrichen.** Ein belastbares Datum liegt bei
konsequenter Abarbeitung etwa **4–6 Wochen** entfernt — vorausgesetzt, Phase 2
verläuft ohne Zwischenfälle.

**Empfohlene Reihenfolge-Warnung:** Der Deploy der 83 Functions **vor** F-04/F-05
würde sechs Auth-Bypässe gleichzeitig scharf schalten. Sicherheit muss zuerst.
