# K5 – Voice-Kalkulation (Vollkosten, Deckungsbeitrag, Freigaberegeln)

Stand: 25.11.2026 · Grundlage: K5-Zielwerte in `shared/pricing.ts` → `VOICE_STANDALONE_OFFERS`
Status: **Prüfgrundlage, keine Verkaufsfreigabe.** Kein Paket ist kaufbar (`bullets` leer,
`VOICE_CHECKOUT_ENABLED` aus, Stripe unverändert).

Die Kennzeichnung unterscheidet **[Quelle]** (Listenpreis mit URL und Abrufdatum) und
**[Annahme]** (eigener Schätzwert, vor der Freigabe zu bestätigen).

## 1. Zielwerte

| Tarif | Monat | Inklusivminuten | Zusatzminute |
|---|---|---|---|
| Starter | 89 € | 500 | 0,19 € |
| Professional | 199 € | 1.200 | 0,17 € |
| Kanzlei / Praxis | 349 € | 2.500 | 0,16 € |

Die Seite `/phonebot/start` nennt nach § 19 UStG keine Umsatzsteuer. Die Kosten sind netto angesetzt.

## 2. Quellen (ATLAS, alle Abrufe am 25.11.2026)

| Position | Wert | Währung | Quelle |
|---|---|---|---|
| ElevenLabs Agents: Pläne | Starter 6/75 Min/6 parallel · Creator 22/275/10 · Pro 99/1.238/20 · Scale 299/3.738/30 · Business 990/12.375/40 · Enterprise auf Anfrage | USD netto | https://elevenlabs.io/pricing/agents |
| ElevenLabs Zusatzminute | 0,080 je Min. (alle Pläne); Sekundärquelle nennt für Business 0,096 bei Monatszahlung (nicht aufgelöst) | USD | dto. |
| ElevenLabs Burst | 0,160 je Min. (2×), bis 3× Concurrency, max. 300 | USD | dto.; https://elevenlabs.io/docs/eleven-agents/guides/burst-pricing |
| ElevenLabs LLM | Pass-through ohne Aufschlag; Vertex-Modelle +10 % | – | https://elevenlabs.io/docs/eleven-agents/customization/llm |
| LLM je Gesprächsminute | gemini-3.5-flash-lite 0,00592 · gpt-5-mini 0,00446 · claude-haiku-5-5 0,00186 · gpt-5.4-mini 0,01292 | USD (API ohne Währungsangabe) | ElevenLabs-API `llm-usage/calculate`, Prompt 4.000 Zeichen, ohne RAG |
| Twilio DE-Ortsnetznummer | 1,35 je Monat | USD | https://www.twilio.com/en-us/voice/pricing/de |
| Twilio eingehend | 0,0100 je Min. | USD | dto. |
| Twilio ausgehend Festnetz / Mobil | 0,0283 / 0,0420 (Ursprung EWR) bzw. 0,3763 (sonst) | USD | dto. (Seite widersprüchlich) |
| Stripe | EWR-Karte 1,5 % + 0,25 € · Premium 2,8 % + 0,25 € · SEPA 0,35 € · Billing 0,7 % | EUR | https://stripe.com/de/pricing, https://stripe.com/de/pricing/local-payment-methods |
| EZB-Referenzkurs | 1 EUR = 1,0963 USD (24.11.2026) | – | https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html |

## 3. Kostenmodell

**Variable Kosten je Minute** (Basisszenario):

| Baustein | $/Min. | Herleitung |
|---|---|---|
| ElevenLabs Agent-Minute | 0,0800 | [Quelle]; effektiv in allen Plänen 0,080 $ (Planpreis ÷ Inklusivminuten) |
| LLM | 0,0065 | [Quelle] gemini-3.5-flash-lite 0,00592 $ + 10 % Vertex |
| Twilio eingehend | 0,0100 | [Quelle] |
| Übergabe an Menschen | 0,0035 | [Annahme] 10 % der Minuten mit Übergabe-Leg, je zur Hälfte Festnetz/Mobil (EWR) |
| Burst-Aufschlag | 0,0040 | [Annahme] 5 % der Minuten im Burst, Aufschlag 1× Minutenpreis |
| **Summe** | **0,1040 $ = 0,0949 €** | |

**Fixkosten je Kunde und Monat:** 19,48 €

| Baustein | €/Monat | Herleitung |
|---|---|---|
| Twilio DE-Ortsnetznummer | 1,23 | [Quelle] 1,35 $ |
| Infrastruktur (Supabase, Agent-Runtime, Monitoring) | 3,00 | [Annahme] |
| Support | 15,00 | [Annahme] 20 Min. je Kunde und Monat × 45 €/h |
| Stripe fix je Rechnung | 0,25 | [Quelle] |

**Umsatzabhängig:** Stripe 3,5 % ([Quelle] Premiumkarte 2,8 % + Billing 0,7 %, bewusst ungünstigster Kartenfall).

**Stressszenario:** variable Minutenkosten +20 % bei 100 % Nutzung, Fixkosten unverändert, Mindest-Deckungsbeitrag 0 €.

## 4. Ergebnis Basisszenario (variable Kosten 0,0949 €/Min.)

| Tarif | 25 % | 50 % | 75 % | 100 % | Stress DB | Zusatzminute |
|---|---|---|---|---|---|---|
| Starter | 61,3 % | 48,0 % | 34,6 % | 21,3 % | 9,47 € | 46,6 % |
| Professional | 72,4 % | 58,1 % | 43,8 % | 29,5 % | 35,91 € | 40,7 % |
| Kanzlei / Praxis | 73,9 % | 56,9 % | 39,9 % | 22,9 % | 32,64 € | 37,2 % |

Deckungsbeitrag in €, Starter: 54,54 / 42,68 / 30,82 / 18,96. Professional: 144,09 / 115,62 / 87,15 / 58,69.
Kanzlei / Praxis: 258,00 / 198,69 / 139,39 / 80,08. Werte bei 25 / 50 / 75 / 100 % Nutzung.

| Regel | Starter | Professional | Kanzlei / Praxis |
|---|---|---|---|
| ≥ 30 % Marge bei 50 % | bestanden | bestanden | bestanden |
| ≥ 15 % Marge bei 100 % | bestanden | bestanden | bestanden |
| ≥ 30 % Marge je Zusatzminute | bestanden | bestanden | bestanden |
| DB ≥ 0 € im Stressszenario | bestanden | bestanden | bestanden |

## 5. Spielraum: maximal zulässige variable Kosten je Minute

| Tarif | Grenze | engste Regel | Puffer zur Basis |
|---|---|---|---|
| Starter | 0,1061 € | 15 % bei 100 % | +11,8 % |
| Professional | 0,1130 € | Zusatzminute 30 % | +19,1 % |
| Kanzlei / Praxis | 0,1058 € | Stressszenario | +11,5 % |

Einzelne ungünstige Faktoren gegenüber der Basis:

| Faktor | variable Kosten | Folge |
|---|---|---|
| ElevenLabs-Zusatzminute 0,096 $ statt 0,080 $ | 0,1102 € | Starter und Kanzlei/Praxis scheitern |
| Übergaben an Mobil zu 0,3763 $ statt 0,042 $ | 0,1101 € | Starter und Kanzlei/Praxis scheitern |
| LLM gpt-5.4-mini statt gemini-3.5-flash-lite | 0,1019 € | alle bestehen |

## 6. Vorsichtsszenario (alle drei Faktoren zusammen, 0,1325 €/Min.)

| Regel | Starter | Professional | Kanzlei / Praxis |
|---|---|---|---|
| ≥ 30 % bei 50 % | bestanden (37,4 %) | bestanden (46,8 %) | bestanden (43,5 %) |
| ≥ 15 % bei 100 % | **nicht bestanden** (0,2 %) | **nicht bestanden** (6,8 %) | **nicht bestanden** (−4,0 %) |
| ≥ 30 % je Zusatzminute | **nicht bestanden** (26,8 %) | **nicht bestanden** (18,6 %) | **nicht bestanden** (13,7 %) |
| DB ≥ 0 € Stress | **nicht bestanden** (−13,09 €) | **nicht bestanden** (−18,22 €) | **nicht bestanden** (−80,15 €) |

Alternativen, damit alle vier Regeln auch im Vorsichtsszenario halten (jeweils eine Stellschraube):

| Tarif | Minuten senken auf | oder Preis anheben auf | Zusatzminute mindestens |
|---|---|---|---|
| Starter | 400 | 105,18 € | 0,20 € |
| Professional | 1.077 | 218,97 € | 0,20 € |
| Kanzlei / Praxis | 1.996 | 432,05 € | 0,20 € |

## 7. Flottenszenarien und ElevenLabs-Plan

[Annahmen] Kundenmix 50 % Starter, 35 % Professional, 15 % Kanzlei/Praxis. 198 Geschäftsstunden
im Monat (22 Tage × 9 h), Spitzenfaktor 3 auf die mittlere Gleichzeitigkeit.

| Kunden | Nutzung | Minuten/Monat | Concurrency | Plan | Umsatz | Kosten Basis | Marge Basis | Marge Vorsicht |
|---|---|---|---|---|---|---|---|---|
| 5 | 50 % | 2.612 | 1 | Starter | 832 € | 374 € | 55,0 % | 43,4 % |
| 5 | 100 % | 5.225 | 2 | Starter | 832 € | 622 € | 25,2 % | 1,8 % |
| 20 | 50 % | 10.450 | 3 | Starter | 3.330 € | 1.498 € | 55,0 % | 43,3 % |
| 20 | 100 % | 20.900 | 6 | Starter | 3.330 € | 2.489 € | 25,2 % | 1,7 % |
| 50 | 50 % | 26.125 | 7 | Creator | 8.325 € | 3.744 € | 55,0 % | 43,3 % |
| 50 | 100 % | 52.250 | 14 | Pro | 8.325 € | 6.223 € | 25,2 % | 1,9 % |
| 100 | 50 % | 52.250 | 14 | Pro | 16.650 € | 7.489 € | 55,0 % | 43,3 % |
| 100 | 100 % | 104.500 | 27 | Scale | 16.650 € | 12.447 € | 25,2 % | 2,0 % |

Weil die effektive Minute in jedem ElevenLabs-Plan 0,080 $ kostet, entscheidet die Concurrency
über den Plan, nicht die Minutenmenge. Nicht geprüft: ob DSGVO-Anforderungen (EU-Datenresidenz,
Zero Retention, AVV) einen Business- oder Enterprise-Plan erzwingen. Das würde die Fixkosten
bei kleinen Flotten deutlich erhöhen.

## 8. Offene Punkte vor einer Freigabe

1. ElevenLabs-Zusatzminute verbindlich klären (0,080 $ oder 0,096 $ bei Monatszahlung). Entscheidend für Starter und Kanzlei/Praxis.
2. Twilio-Tarif für Übergaben an Mobilnummern im Konsolen-Preis-CSV prüfen, oder Übergabe per SIP Refer bzw. an Festnetz begrenzen.
3. LLM-Modell festlegen (Basis: gemini-3.5-flash-lite). Gemini 2.5 wird bei ElevenLabs am 30.11.2026 entfernt (Sekundärquelle).
4. Support- und Infrastruktur-Annahmen mit realen Werten ersetzen.
5. Datenschutz-Anforderungen an den ElevenLabs-Plan klären.
6. Wechselkursrisiko: Alle Providerkosten sind in USD. Ein um 10 % schwächerer Euro erhöht die variablen Kosten um etwa 10 %.

Rechenweg: Das Skript liegt nicht im Repo. Alle Formeln stehen in Abschnitt 3. Marge = (Preis − Kosten) ÷ Preis.
