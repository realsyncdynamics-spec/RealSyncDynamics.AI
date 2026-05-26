# RealSync Agency Pilot — Multi-Website Governance Monitoring

**Für Datenschutz-Agenturen, externe DSBs und Web-Agenturen mit
mehreren Mandanten-Websites.**

---

## Was Sie bekommen

- **5 Mandanten-Websites** unter kontinuierlichem Monitoring
- **14 Tage Pilotlaufzeit** (verlängerbar auf 30/90 Tage)
- **Initialer Risiko-Scan** je Website
- **Wöchentlicher Re-Scan**, vollautomatisch
- **Evidence Report** je Website (PDF + Markdown)
- **Replayable Evidence Bundle** (SPEC-001, lokal verifizierbar mit
  `realsync-cli` ohne Zugriff auf unser System)
- **Abschluss-Call** (60 Min) mit Befundpriorisierung und Roadmap

## Was wir erkennen

| Kategorie | Beispiel |
|---|---|
| Pre-Consent Tracking | Google Analytics lädt vor Cookie-Banner-Klick |
| Unbekannte Vendoren | Drittdomain ohne AVV / nicht in Vendor-Liste |
| Fehlende Pflichtelemente | Kein Impressum-Link im Footer, fehlende Datenschutzseite |
| AI-/Chatbot-Widgets | Intercom, Drift, Tidio o.ä. ohne dokumentierte Datenflüsse |
| Nicht-kategorisierte Cookies | Cookies ohne Zweck/Kategorie im Consent-Manager |

Jeder Befund hat **Severity, Evidence, Empfehlung**. Keine Buzzwords,
keine 50-Seiten-PDFs.

## Was wir *nicht* versprechen

- Keine „garantierte DSGVO-Konformität" — die liegt beim Verantwortlichen.
- Keine „vollständige" Vendor-Erkennung — wir nennen nur, was wir
  beobachten, und nennen Lücken offen.
- Kein juristischer Rat. Die Reports sind technische Befunde, nicht
  Rechtsgutachten.

## Preis

Zwei Optionen — Sie wählen:

| Option | Preis | Laufzeit | Anschluss |
|---|---|---|---|
| **A — Einmalig** | 499 € (5 Sites) · 1.500 € (bis 20 Sites) | 14 Tage | Abschluss-Call, kein Folge-Abo notwendig |
| **B — Pilot-Abo** | 299 € / Monat | 3 Monate | Übergang in reguläres Agency-Abo möglich |

Beides per Stripe-Link, EU-Rechnung, keine Mindestlaufzeit über die
14 Tage hinaus.

## Lieferumfang im Detail

| Liefergegenstand | Format | Wann |
|---|---|---|
| Onboarding-Call (30 Min) | Video | Tag 1 |
| Erst-Scan + Report | PDF/MD | Tag 2–3 |
| Wöchentlicher Re-Scan-Report | PDF/MD | Tag 8 |
| Evidence Bundle (SPEC-001) | JSON, signiert | nach jedem Scan |
| Findings-Dashboard | Web | live über Pilotlaufzeit |
| Abschluss-Call | Video, 60 Min | Tag 14 |

## Voraussetzungen auf Ihrer Seite

- Mandant-Einverständnis, dass wir die öffentlichen URLs scannen
  (kein Auth-Zugriff nötig)
- 1 Ansprechperson bei Ihnen für Rückfragen
- AVV-Anhang unterschrieben (1-Seiter, EU-konform, Standardvertragsklauseln nicht nötig — Server in DE/EU)

## Technische Hinweise

- Scanner agiert wie ein anonymer Browserbesuch (kein Login)
- Keine Bots-Belastung: 1 Scan-Lauf pro Site pro Woche, max. 30 Requests/Site
- Daten in EU (Hetzner DE), keine Drittlandstransfers
- Evidence-Bundles sind kryptographisch signiert (Ed25519) und können
  unabhängig von uns geprüft werden — Sie können also auch nach
  Pilot-Ende verifizieren, was wir wann gefunden haben

## Was Sie nach 14 Tagen haben

- 5 Berichte, die Sie direkt mit Ihren Mandanten besprechen können
- Eine Liste priorisierter Befunde mit Empfehlungen
- Eine technische Demonstration der Replay-/Verification-Fähigkeit
- Eine Entscheidungsgrundlage: weitermachen ja / nein

## Kontakt

E-Mail: support@realsyncdynamicsai.de
Web: realsyncdynamicsai.de/agencies → „Agency Pilot anfragen"

---

*RealSync ist ein conceptual reference prototype für Governance-Runtime-
Infrastruktur. Die kryptographischen Primitive (Ed25519, SHA-256) sind
real und auditierbar. Operative Reife (Key-Rotation, Trust-Distribution,
signierte Zeitstempel) ist im Aufbau. Use at your own discretion.*
