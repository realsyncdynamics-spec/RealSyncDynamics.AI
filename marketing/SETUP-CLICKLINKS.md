# Setup-Click-Links — Stufe 1 abschließen in 45 Minuten

Alle Click-Links direkt zum Ziel. Reihenfolge ist wichtig: Resend zuerst (Domain-Verify dauert DNS-Propagation), parallel Calendly + Stripe-Pricing.

---

## Block A — Resend (Email-Versand) · ~20 min

### A1. Account anlegen
**Click**: https://resend.com/signup

**Frage**: "What's your use case?" → wähle **"Transactional emails"**.
Free-Tier: 100 Emails/Tag, 3.000/Monat — reicht locker für die ersten ~50 Audits/Tag.

### A2. Domain hinzufügen
**Click**: https://resend.com/domains

→ "Add Domain" → `realsyncdynamicsai.de` → Region "EU (Ireland)" wählen (DSGVO!).

### A3. DNS-Records bei Hostinger eintragen
Resend zeigt dir 3 Records (MX, TXT für SPF + DKIM). **Click zu Hostinger DNS**:
https://hpanel.hostinger.com/?dns

→ Domain `realsyncdynamicsai.de` → "DNS / Nameservers" → "Manage DNS Records".

Pro Record (3×):
- **Add Record** → wähle Typ (MX/TXT) → Name + Value 1:1 von Resend kopieren → TTL `3600` → Save.

⏳ **Wartezeit**: 5–30 Min für DNS-Propagation. In Resend → "Verify" klicken bis grün ✅.

### A4. API-Key erstellen
**Click**: https://resend.com/api-keys

→ "Create API Key" → Name `prod-realsyncdynamics` → Permission `Sending access` → **Domain `realsyncdynamicsai.de`** wählen (nicht "Full access"!).

→ Key kopieren. Beginnt mit `re_...`. **Niemals** committen!

### A5. Key in Supabase Edge Function setzen
**Click direkt zur Function-Settings**:
https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/functions/audit-report-email/details

→ Tab **"Secrets"** (oben) → "Add new secret":
- `RESEND_API_KEY` = `re_...` (dein Key)
- `AUDIT_EMAIL_FROM` = `audit@realsyncdynamicsai.de` (optional, ist auch Default)

→ "Save".

### A6. Sofort-Test
Triggert eine Test-Email an dich selbst:
**Click**: https://realsyncdynamicsai.de/audit

→ Eigene Domain (`realsyncdynamicsai.de`) eintragen → eigene Email → "Jetzt prüfen".
- Browser zeigt Score + Befunde.
- Email kommt in 5–60 Sek. an. Wenn nicht: Resend-Dashboard `https://resend.com/emails` checken (zeigt Bounces/Errors).

✅ **Wenn Email kommt**: Block A done. Pipeline ist live.

---

## Block B — Calendly (Demo-Booking) · ~15 min

### B1. Account
**Click**: https://calendly.com/signup

→ Sign up with Google/Microsoft Calendar.

### B2. Event-Type "DSGVO-Demo" anlegen
**Click**: https://calendly.com/event_types/new

- Type: **One-on-One**
- Name: **DSGVO-Compliance-Demo**
- Duration: **30 minutes**
- Location: **Zoom / Google Meet** (auto-create-link)
- Description:
  > "30 Min Live-Walkthrough: Audit Eurer Site + zeige passende Lösung. Kein Pitch, Discovery-first."
- Available hours: Mo-Fr 9-12, 14-17 (oder nach Belieben)

### B3. URL kopieren
Nach Save zeigt Calendly die URL: `https://calendly.com/<dein-handle>/dsgvo-demo`.

### B4. URL als GitHub-Secret setzen
**Click direkt zu GH Secrets**:
https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/settings/secrets/actions

→ "New repository secret":
- Name: `VITE_CALENDLY_URL`
- Value: `https://calendly.com/<dein-handle>/dsgvo-demo`

→ "Add secret".

### B5. Re-Deploy auslösen
**Click direkt zum Workflow**:
https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions/workflows/deploy-pages.yml

→ "Run workflow" → Branch `main` → "Run workflow" Button.

⏳ ~3 min bis Deploy fertig.

### B6. Test
**Click**: https://realsyncdynamicsai.de/contact-sales

→ Sollte oben einen grünen Block "Direkt buchen — schneller Termin" zeigen mit Button "Termin im Kalender wählen →".

✅ **Wenn Block sichtbar**: Block B done.

---

## Block C — Stripe-Pricing in Production · ~10 min

Aktuell sind die Tier-Preise als "internal_default_*" sentinels in `public.products` gespeichert. Damit Pilot-Trial funktioniert, brauchst Du echte Stripe-Prices.

### C1. Stripe-Dashboard
**Click**: https://dashboard.stripe.com/products

→ "Add product" 3×:

| Name              | Price (EUR) | Recurring   | plan_key (Metadata) |
|-------------------|-------------|-------------|---------------------|
| RealSync Bronze   | 29          | Monthly     | `bronze`            |
| RealSync Silver   | 99          | Monthly     | `silver`            |
| RealSync Gold     | 299         | Monthly     | `gold`              |

Pro Produkt: **Pricing model** = "Standard pricing" → "Recurring" → 29 / 99 / 299 EUR → Monthly → Save.

### C2. Price-IDs notieren
Nach Save zeigt Stripe Price-IDs wie `price_1OabcdEFghIJ...`.

### C3. Products-Tabelle in Supabase updaten
**Click direkt zum SQL Editor**:
https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/sql/new

→ Paste + Run (mit deinen echten Price-IDs ersetzen):
```sql
UPDATE public.products SET stripe_price_id = 'price_BRONZE_VON_STRIPE'
WHERE default_for_plan_key = 'bronze';

UPDATE public.products SET stripe_price_id = 'price_SILVER_VON_STRIPE'
WHERE default_for_plan_key = 'silver';

UPDATE public.products SET stripe_price_id = 'price_GOLD_VON_STRIPE'
WHERE default_for_plan_key = 'gold';
```

### C4. Test
**Click**: https://realsyncdynamicsai.de/pricing?pilot=true

→ Sollte grünen "Pilot-Modus aktiv" Banner zeigen → Login → Silver wählen → Stripe Checkout → 14-day-Trial sichtbar.

✅ **Wenn Trial-Page anzeigt "First charge after 14 days"**: Block C done.

---

## Block D — Eigene Site self-auditen · ~10 min

### D1. Audit laufen lassen
**Click**: https://realsyncdynamicsai.de/audit

→ URL: `realsyncdynamicsai.de` → Eigene Email → "Jetzt prüfen".

→ Score notieren. Befunde durchgehen.

### D2. Befunde fixen
Häufigste Findings + Fixes:
- **Cookie-Banner Reject-Button fehlt** → Cookie-Component mit gleichberechtigtem Reject-Button erweitern
- **Tracker pre-consent** → Google Analytics conditional auf consent
- **Mixed Content** → http-Asset-URLs auf https umstellen
- **AVV nicht erwähnt im Datenschutz** → einen Satz "Wir nutzen folgende Auftragsverarbeiter: ..." in /legal/privacy einfügen

Falls du fixe brauchst: sag mir den exakten Befund-Text aus deinem Audit, ich liefere den Code-Fix.

### D3. Score-Card teilen
Sobald Score ≥80, **Click**: dein Audit-Result-Page → "Score teilen" → LinkedIn.

Auto-Text:
> "Meine Website hat 87/100 im DSGVO-Audit von RealSyncDynamics.AI erreicht. Hier ist der Report: [link]"

✅ **Wenn LinkedIn-Post live**: Block D done. Stufe 3 erfolgreich.

---

## Block E — LinkedIn-Profil + Erster Post · ~30 min

### E1. Profil-Headline
**Click**: https://www.linkedin.com/in/me/edit/contact-info/

→ Headline-Edit:
> "Hilft Kanzleien & HealthTech-Startups DSGVO + AI Act compliant zu werden — in 14 Tagen, nicht 6 Monaten | Founder RealSyncDynamics.AI"

### E2. Featured-Section
**Click**: https://www.linkedin.com/in/me/

→ Profile-Header rechts → "..." → "Add to profile" → "Featured".

Als Featured Items hinzufügen:
- https://realsyncdynamicsai.de/audit (Title: "Kostenloser DSGVO-Scanner")
- https://realsyncdynamicsai.de/dsgvo-ki-checkliste (Title: "DSGVO-KI-Checkliste 28 Punkte")
- https://realsyncdynamicsai.de/ai-act-faq (Title: "EU AI Act FAQ — 18 Fragen")

### E3. Pinned-Post
Erster Post veröffentlichen: **Click**: https://www.linkedin.com/feed/?shareActive&mini=true

Text aus `marketing/linkedin-templates.md` → Post 1 (Schrems-II).

Nach Veröffentlichung **Click** auf den Post → "..." → "Pin to profile".

✅ **Wenn Pinned-Post live**: Stufe 2 done.

---

## Komplett-Status-Check

Wenn alle 5 Blocks ✅ sind, hast Du Stufe 1-3 abgeschlossen:

- [ ] Block A — Resend Email-Pipeline
- [ ] Block B — Calendly Demo-Booking
- [ ] Block C — Stripe Pilot-Trial
- [ ] Block D — Self-Audit + Score-Card geteilt
- [ ] Block E — LinkedIn scharfgestellt

**Nächste Stufe** (Stufe 4-5): Sales-Navigator-Trial + 100-Ziel-Liste + 50 Cold-DMs.

→ Anleitung: `marketing/icp-und-sales-navigator.md` + `marketing/linkedin-templates.md`.

---

## Wenn was nicht läuft

| Symptom | Wahrscheinliche Ursache | Fix |
|---------|--------------------------|-----|
| Resend "Verification failed" | DNS noch nicht propagiert | 30 min warten, dann erneut "Verify". Falls dann immer noch: TXT-Records bei Hostinger nochmal kontrollieren auf Tippfehler |
| Audit-Email kommt nicht | RESEND_API_KEY-Format falsch | Key beginnt mit `re_`. Edge Function Logs: https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/functions/audit-report-email/logs |
| Calendly-Block unsichtbar | VITE_CALENDLY_URL nicht im Bundle | Workflow-Run aus B5 ausführen — Build muss neu laufen damit env-var ins JS-Bundle kommt |
| Stripe Checkout 400 "PRICE_NOT_CONFIGURED" | products-Tabelle hat noch internal_default_* | C3 SQL ausführen |
| `/pricing?pilot=true` zeigt KEINEN Banner | Build veraltet | Hard-Refresh (Cmd+Shift+R) oder neuen Workflow-Run |

Bei jedem Problem: Befund-Text + Fehler-Message senden, ich fix's.
