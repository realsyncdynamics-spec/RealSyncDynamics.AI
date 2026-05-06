# ICP-Definition + Sales-Navigator-Suchstrings

## Ideal Customer Profile (ICP)

**Primär**: B2B in DACH, **Decision-Maker** (Geschäftsführung, IT-Leitung, Datenschutz),
**KI bereits in Nutzung** ODER **planen Einsatz innerhalb 6 Monaten**, **regulierte Branche**.

### Kriterien (alle müssen ✓)

- [ ] Sitz in DE / AT / CH
- [ ] 5–500 Mitarbeiter (zu klein = kein Budget; zu groß = enterprise-cycle zu lang)
- [ ] Branche: Rechtsdienstleistung, HealthTech/Med, FinTech/Banking, öffentliche Verwaltung, Compliance-Beratung
- [ ] Online-Präsenz mit Cookie-Banner (= aktives Marketing, also Datenschutz-relevant)
- [ ] Decision-Maker erreichbar (LinkedIn-aktiv, idealerweise Posts in letzten 90 Tagen)

### Disqualifier (sofort skippen)

- ❌ Reine Privatpraxen ohne IT-Verantwortliche
- ❌ Konzern (Siemens, Allianz, ...) — Sales-Cycle zu lang, ICP zu groß
- ❌ Pure-US-/UK-Kunden — DSGVO-Relevanz schwächer
- ❌ Solo-Freelancer

## Sales Navigator Suchstrings

### Filter 1: Kanzleien (Recht)

```
Geo: DE, AT, CH
Industry: Legal Services / Law Practice
Title contains: Datenschutz, Compliance, Partner, Geschäftsführer, IT-Leitung
Company size: 11-200 employees
Spotlight: Recently posted on LinkedIn (within 30 days)
```

**Suchstring-Variante** (LinkedIn-Suche):
```
"Datenschutz" OR "Compliance" Anwalt -solo
```

### Filter 2: HealthTech (Med + Software)

```
Geo: DE, AT, CH
Industry: Hospital & Health Care, Medical Devices, Pharmaceuticals
Title contains: CTO, CIO, CISO, Founder, Head of Engineering, Datenschutzbeauftragte
Company size: 11-500
Keyword (firm-level): "AI" OR "KI" OR "Machine Learning"
Funding stage: Series A or B
```

**Suchstring**:
```
HealthTech CTO Germany AI OR ML
```

### Filter 3: FinTech / BAIT-relevant

```
Geo: DE, AT, CH
Industry: Financial Services, Banking, Investment Management
Title: CTO, CISO, Compliance Officer, Risk Manager
Company size: 11-500
Keywords: BAIT, MaRisk, BaFin, Compliance
```

### Filter 4: Behörden / Public Sector

```
Geo: DE, AT, CH
Industry: Government Administration, Public Safety
Title: Digitalisierungsbeauftragter, CIO, IT-Leitung, Datenschutzbeauftragter
Company size: 51-1000
Keywords: Verwaltung, Digitalisierung
```

### Filter 5: DSGVO-Beratung (Partner-Channel)

```
Geo: DE, AT, CH
Industry: Management Consulting, Legal Services
Title: Geschäftsführer, Partner, Senior Consultant
Keywords: Datenschutz, DSGVO, Compliance
Company size: 2-50
```

→ Diese werden NICHT direkt-DM'd. Stattdessen Partner-Approach (`/agencies` revenue-share-Modell anbieten).

## Apollo.io alternative (falls kein Sales Navigator)

```
Filter:
- Country: DE, AT, CH
- Industry: Legal, Healthcare, Financial Services, Government
- Department: IT, Compliance, Executive
- Seniority: Director, VP, C-Suite
- Company size: 11-500
- Email status: Verified
```

**Limit Free**: 60 verified emails/month. Reicht für Welle 1.

## Workflow: Liste → /outreach

1. Sales Navigator → **Save to list** (z. B. "DSGVO-DM-Welle-1")
2. Export oder per Hand: Name, Firma, LinkedIn-URL, Branche, größenklasse
3. Insert in Supabase:

```sql
INSERT INTO public.outreach_contacts (name, company, linkedin_url, industry, status, gap_id)
VALUES
  ('Max Mustermann', 'Kanzlei XY', 'https://linkedin.com/in/...', 'Legal', 'new', NULL),
  -- ... 99 mehr
;
```

Oder via `/outreach` UI → "+ Neuer Kontakt" → 1×1.

4. Nach jeder DM: Status auf `contacted`, nach Reply auf `replied`, etc.

## Reply-Rate-Erwartung

| Branche      | Cold-DM Reply-Rate | Cold-DM mit Pre-Engagement* |
|--------------|--------------------|-----------------------------|
| Kanzleien    | 4–6 %              | 12–15 %                     |
| HealthTech   | 8–12 %             | 18–25 %                     |
| FinTech      | 3–5 %              | 10–13 %                     |
| Behörden     | 2–4 %              | 8–10 %                      |

\* Pre-Engagement = vor DM erst 1 ihrer Posts kommentiert + ihnen einen ihrer eigenen Wins gegönnt. Verdoppelt Reply-Rate.

## Tagesablauf

**Morgen-Routine (30 min):**
1. 5 Connection-Requests aus Liste (mit personalisierter Note unter 200 chars)
2. Auf 2-3 Branchen-Posts kommentieren (substantiell, nicht "Great post!")
3. 1× Eigenen Post veröffentlichen (Mo/Mi/Fr aus Templates)

**Nachmittag (45 min):**
1. 10× Cold-DM aus Liste (Templates aus `linkedin-templates.md`)
2. Status in `/outreach` updaten
3. Eingegangene Replies bearbeiten (siehe `objection-handling.md`)

**Abend (15 min):**
1. KPI-Zähler: Heute X DMs raus, Y Replies eingegangen
2. Abend-Reflection: was hat gewirkt, was nicht

## Tools

- **LinkedIn Sales Navigator**: 1 Monat kostenlos, danach 99€/M (lohnt sich)
- **Apollo.io Free**: 60 Emails/M, Verified-Email-Discovery
- **Streak (Gmail Plugin)**: Tracking ob Email geöffnet
- **Loom**: 30-Sek-Video-DMs (Reply-Rate +30 %)
- **`/outreach` UI**: Eigenes CRM
