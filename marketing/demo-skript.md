# Demo-Skript — 30 Minuten "DSGVO-Compliance-Walkthrough"

**Ziel der Demo**: Von Cold-Lead zu klarem Ja/Nein für Pilot. Nicht "Pitch", sondern Discovery + Live-Audit.

---

## Pre-Call (5 min vor Termin)

- [ ] Audit der Lead-Domain durchgelaufen lassen → Score notiert
- [ ] LinkedIn-Profil vom Gegenüber 60 Sek gescannt (zuletzt geposteter Content?)
- [ ] Internes CRM: welcher Hook hat funktioniert (`/outreach` notes)
- [ ] Calendly-Notiz prüfen: was sie als "Use-Case" geschrieben haben

---

## Min 0–2: Opener

> "Hallo {NAME}, danke dass Du Dir 30 Minuten Zeit nimmst. Ich hab kurz vorab Eure Site durch unseren DSGVO-Scanner laufen lassen — Score: {SCORE}/100. Ich zeig Dir gleich, was die Befunde sind, dann reden wir wo's im Alltag wirklich brennt."

**Warum**: Sofort konkret, nicht generisch. Score ist ein Hook.

---

## Min 2–8: Live-Audit-Walkthrough (gemeinsamer Screen)

1. realsyncdynamicsai.de/audit aufrufen
2. Ihre Domain einfügen, Email = ihre Email, Submit
3. Während Score lädt, ein-zwei Sätze Hintergrund:
   > "Das hier checkt 19 typische DSGVO-Fallen. Score von 100 runter, jeder Befund hat einen Paragraphen-Verweis."
4. Score zeigen + 2-3 wichtigste Befunde aufmachen.
5. Wenn Top-Befund kritisch ist (z. B. Hotjar pre-consent):
   > "Das ist ein klarer §25 TTDSG-Verstoß, BfDI hat in 2024 dazu eine Leitlinie veröffentlicht — Bußgeld-Range startet bei 1.000€."
6. Falls Score >80: glückwunsch, weniger DM-Material:
   > "Sehr gut — das ist seltener als Du denkst. Fokus heute auf KI-spezifische Punkte."

---

## Min 8–18: Discovery — die *eigentliche* Demo

**Hauptfragen** (mind. 5 davon stellen):

1. "Welche KI-Tools setzt Ihr aktuell ein? (ChatGPT, Claude, Gemini, intern? Slack-AI?)"
2. "Habt Ihr für jeden davon einen aktuellen AVV (Auftragsverarbeitungsvertrag)?"
3. "Wer ist bei Euch DSB? Intern oder extern?"
4. "Wie dokumentiert Ihr aktuell, wer welche Daten an welche AI schickt?"
5. "Habt Ihr schon mal eine Aufsichts-Anfrage zur KI-Nutzung bekommen?"
6. "Was ist der Anlass, warum Du mit mir sprichst — gab's einen Trigger?"

**Hör zu**, nicht pitchen. Schreib mit. Pain-Points werden direkt von ihnen kommen.

**Typische Pain-Points**, die du bestätigst:
- "Wir haben kein zentrales Audit-Log"
- "Unser DSB sagt dass GPT problematisch ist, wir wissen nicht wie weiter"
- "Mandanten fragen nach AVV, wir haben aber keinen"
- "AI Act ab August macht uns nervös"

---

## Min 18–25: Solution-Walkthrough (kurz, gezielt)

**Nur die Features zeigen, die zu deren Pain matchen.** Nicht alles.

### Wenn Pain = "Audit-Log fehlt":
- Zeig `/billing/usage` → Tabelle mit jedem AI-Call: User, Modell, Tokens, Kosten, Residenz, Zeit
- "Das hier ist live für jeden Provider — Anthropic, OpenAI, Google, oder EU-local Ollama. Filtertbar nach Tenant und User."

### Wenn Pain = "AVV fehlt":
- Zeig `/legal/avv` → AVV-Template
- "10-Paragraphen, gemäß DSGVO Art. 28 Abs. 3, mit TOM-Anhang. Kannst Du Mandanten direkt schicken."

### Wenn Pain = "EU-Datenresidenz":
- Zeig `/settings/ai-residency` → Toggle + Tenant-Override
- "Pro Mandant erzwingbar. EU-only setzt automatisch auf Ollama in Frankfurt, sensible Cases laufen lokal."

### Wenn Pain = "AI Act-Compliance":
- Zeig `/legal/compliance-matrix` → 18-Kriterien × 4-Provider Vergleich
- "Wir haben die Konformitätsbewertung pro Provider durchgespielt. Du kriegst die Matrix als PDF für Dein Risk-Management."

**Nicht zeigen**: Workflows, Marketing, Outreach-Tracker. Das ist *unser* Stuff, nicht ihrer.

---

## Min 25–28: Pricing + Pilot-Angebot

> "Drei Tiers — Bronze 29€/M, Silver 99€/M, Gold 299€/M. Was Du gerade gesehen hast, geht alles in Silver. Bei größeren Setups (>10 Tenants) reden wir individuell."
>
> "Ich mach Dir ein Pilot-Angebot: 14 Tage Silver kostenlos. Falls es passt, läuft's danach 99€/M weiter — falls nicht, kostet's nix. Bedingung: ehrliches Feedback nach 7 Tagen."

**Stille aushalten.** Nicht reden bis sie reden.

---

## Min 28–30: Close

**Wenn Ja**:
> "Super. Ich schick Dir gleich den Setup-Link + AVV-Template. Bis Freitag bist Du live. Wir telefonieren am Tag 7 für ehrliches Feedback."

**Wenn Vielleicht**:
> "Was müsste passieren, damit aus Vielleicht ein Ja wird? Was ist das echte Hindernis?" — höre zu, schreibe mit.

**Wenn Nein**:
> "Verstanden. Was ist der Hauptgrund? — damit ich's verstehe, nicht damit ich Dich umstimme."
> Danach: "Darf ich Dich in 6 Monaten nochmal fragen, falls sich was ändert?"

**IMMER**: Nach dem Call innerhalb 30 Min Follow-Up-Email mit:
1. Score + 3 wichtigste Befunde aus Audit
2. AVV-Template-Link
3. Compliance-Matrix-PDF
4. Stripe-Checkout-Link (oder Calendly für Folge-Termin)

---

## Common Mistakes — vermeiden

- ❌ **Zu viel pitchen, zu wenig fragen.** 60% Reden vom Lead, 40% du.
- ❌ **Features statt Outcomes**. "Audit-Log" → "Du kannst der Aufsichts-Anfrage in 14 Tagen vorlegen".
- ❌ **Preis verteidigen.** Wenn sie sagen "zu teuer", frag: "verglichen womit?" Nicht runtergehen.
- ❌ **Zu viel zeigen.** 3 Features die ihren Pain lösen > 10 die's nicht tun.
- ❌ **Demo verlängern.** 30 Min hart, danach kommt's nicht weiter — Folge-Termin ist Closer-Job.

## Post-Demo: Loose Ends in `/outreach`

- Status updaten: `meeting → deal | lost`
- Notes-Field: was war ihr Pain, was war Einwand, nächster Step
- Set Follow-Up-Date wenn `lost` aber "in 6 Monaten" → Calendar-Reminder

## Erfolgsmetriken

| Metrik                  | Ziel    | Aktion bei Verfehlen                    |
|-------------------------|---------|-----------------------------------------|
| Demos pro Woche         | 2+      | Reply-Rate-Issue, Templates anpassen    |
| Demo→Pilot-Conv         | 50%     | Demo-Skript schwächt, Discovery erweitern |
| Pilot→Paid-Conv         | 60%     | Pilot-Onboarding verbessern             |
| Avg. Sales-Cycle (T)    | <14     | Längere Cycles → falscher ICP           |
