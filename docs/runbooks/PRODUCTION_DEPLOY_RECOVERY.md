# Production Deploy Recovery — Befund 1 (2026-09-04)

**Status**: 🔴 High — Alte Seite live (`PublicWorkspacePreview` statt `MainLanding`)  
**Ort**: https://realsyncdynamicsai.de  
**Erwartet**: Bolt-Design mit „Earth at Night"  
**Aktuell**: Alte Governance-Seite mit Radar-Grafik  

---

## Diagnose-Verfahren

### Schritt 1: Welche Seite ist wirklich live?

```bash
# Terminal — prüfe, welcher Content ausgeliefert wird
curl -s https://realsyncdynamicsai.de/ | head -100 | grep -i "earth\|bolt\|governance\|radar"

# Erwartet (neu): "Earth", "Night", "Bolt", oder Text aus MainLanding
# Aktuell (alt): "Governance OS", "Radar", "Workspace" — Hinweis auf PublicWorkspacePreview
```

**→ Bestätigt**: Wenn die alte Seite zurückkommt, liegt ein Deploy-Problem vor.

### Schritt 2: Cloudflare vs. GitHub Pages — Wer antwortet?

```bash
# Terminal — welcher Origin antwortet?
curl -sI https://realsyncdynamicsai.de/ | grep -i "server\|cf-\|x-github"

# Cloudflare Pages antwortet mit:
#   Server: cloudflare
#   CF-RAY: <ID>
#
# GitHub Pages antwortet mit:
#   Server: GitHub.com
```

**→ Wenn GitHub Pages antwortet**: DNS zeigt noch auf alten Origin.

### Schritt 3: DNS-Einträge prüfen

```bash
# Terminal — welcher Nameserver ist konfiguriert?
dig realsyncdynamicsai.de NS

# Erwartet: Cloudflare Nameserver
#   ns1.cloudflare.com
#   ns2.cloudflare.com
```

```bash
# Terminal — welcher A-Record?
dig realsyncdynamicsai.de A

# Erwartet (Cloudflare Pages): 
#   ALIAS / CNAME → realsyncdynamics-ai.pages.dev
#   oder direkter A-Record zu Cloudflare
#
# Falsch (GitHub Pages):
#   185.199.108.153 (GitHub Pages IP)
```

**→ Wenn GitHub Pages IP zurückkommt**: Das ist das Problem!

---

## Fix nach Ursache

### **Ursache A: DNS zeigt auf GitHub Pages**

**Schritte:**
1. Cloudflare Dashboard → DNS
2. Suche den A- oder CNAME-Record für `realsyncdynamicsai.de`
3. Ändere ihn auf Cloudflare Pages:
   - **Type**: `CNAME` oder `ALIAS` (je nach Registrar)
   - **Name**: `realsyncdynamicsai.de` (oder `@`)
   - **Target**: `realsyncdynamics-ai.pages.dev`
   - **Proxy**: `Proxied` (Orange Cloud, nicht Gray)
4. Speichern
5. **Warte 5–10 Minuten** auf DNS-Propagation

**Verifizierung:**
```bash
dig realsyncdynamicsai.de A
# Sollte jetzt auf Cloudflare zeigen, nicht auf 185.199.108.x
```

---

### **Ursache B: Deploy-Secrets fehlen**

**Symptom**: Workflow-Log zeigt „Cloudflare Actions deploy skipped" (Notice auf Zeile 78).

**Fix:**
1. GitHub Repo → Settings → Secrets and variables → Actions
2. Setze diese Secrets:
   - `CLOUDFLARE_API_TOKEN` — von Cloudflare Dashboard
   - `CLOUDFLARE_ACCOUNT_ID` — von Cloudflare Dashboard
3. GitHub → Actions → Deploy to Cloudflare Pages → Klick „Run workflow"
4. Warte auf grünen Haken (ca. 5–10 Min)
5. Verifiziere: https://realsyncdynamicsai.de sollte neue Seite zeigen

---

### **Ursache C: Workflow läuft, aber schlägt fehl**

**Prüfschritt:**
1. GitHub → Actions → „Deploy to Cloudflare Pages"
2. Letzte Runs anschauen
3. Falls rot ❌:
   - Run aufklappen
   - **Build**-Step prüfen (TypeScript-Fehler?)
   - **Deploy**-Step prüfen (Cloudflare-Fehler?)
4. Bei TypeScript-Fehler:
   ```bash
   npm run lint
   npm run build
   ```
   lokal ausführen und Fehler beheben

---

## Checkliste zur Fehlerbehebung

**A — DNS-Problem?**
- [ ] `curl -sI https://realsyncdynamicsai.de/ | grep Server` → zeigt `cloudflare` (neu) oder `GitHub.com` (alt)?
- [ ] `dig realsyncdynamicsai.de A` → Cloudflare oder GitHub IP?
- Falls GitHub IP:
  - [ ] Cloudflare Dashboard → DNS
  - [ ] CNAME/ALIAS auf `realsyncdynamics-ai.pages.dev`
  - [ ] 5–10 Min warten

**B — Secrets-Problem?**
- [ ] GitHub Settings → Secrets → `CLOUDFLARE_API_TOKEN` vorhanden?
- [ ] GitHub Settings → Secrets → `CLOUDFLARE_ACCOUNT_ID` vorhanden?
- Falls nein:
  - [ ] Werte von Cloudflare Dashboard kopieren
  - [ ] Secrets setzen
  - [ ] Workflow manuell triggern (Actions → „Deploy to Cloudflare Pages" → „Run workflow")

**C — Build-Fehler?**
- [ ] GitHub Actions → Letzte Deploy-Runs
- [ ] Rot ❌? → Step-by-Step Log lesen
- Falls TypeScript-Fehler:
  - [ ] `npm run lint` lokal
  - [ ] `npm run build` lokal
  - [ ] Fehler beheben
  - [ ] Commit + Push

---

## Test nach dem Fix

```bash
# 1. Warte 5 Min nach DNS-Änderung
sleep 300

# 2. Prüfe, dass neue Seite antwortet
curl -s https://realsyncdynamicsai.de/ | grep -i "earth\|bolt" && echo "✓ Neue Seite live!" || echo "❌ Alte Seite noch live"

# 3. Prüfe /pricing
curl -s https://realsyncdynamicsai.de/pricing | grep -i "Welche Governance" && echo "✓ Pricing OK" || echo "❌ Pricing falsch"
```

---

## Kontext: Warum das passiert ist

**Code ist korrekt:**
- `src/App.tsx` Zeile 491: `<Route path="/" element={<MainLanding />} />`
- `MainLanding.tsx` existiert und ist in `main`

**Problem war Infrastruktur:**
- Cloudflare Pages als Ziel wurde nicht konfiguriert (DNS + Secrets)
- Oder: Build läuft, aber altes Deployment läuft noch live
- Das ist **nicht** im Code fixbar — es ist ein Betriebsproblem

**Die Checkliste oben behebt es.**

---

## Links & Referenzen

- Cloudflare Pages Setup: `docs/runbooks/cloudflare-actions-deploy-cutover.md`
- GitHub Actions: `.github/workflows/deploy-cloudflare-pages.yml` (Zeile 63–79 prüfen Secrets)
- Deployed Seite: https://realsyncdynamicsai.de
- Code: `src/pages/MainLanding.tsx` (Bolt-Design)

