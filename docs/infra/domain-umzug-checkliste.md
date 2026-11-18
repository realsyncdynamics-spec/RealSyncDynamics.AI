# Domain-Umzug: `realsyncdynamicsai.de` auf die SPA

Stand: 18.11.2026. Diese Checkliste wurde **nicht ausgeführt**. Für die Ausführung
braucht es die Freigabe des Owners, weil sie die Produktion betrifft (`AGENTS.md`,
Abschnitt „Freigaben“).

## Ziel

Apex und `www` sollen nicht mehr aus dem Pages-Projekt `realsync-landing` kommen
(Branch `landing-live`, statischer Claude-Design-Export), sondern aus dem
SPA-Projekt `realsyncdynamics-ai` (Branch `main`).

Was sich danach ändert:

- `https://realsyncdynamicsai.de/` zeigt die Startseite v3 (seit #2305 auf `main`)
  statt der statischen Seite.
- Unterseiten wie `/pricing` liefern direkt `200`. Bisher leitet die Domain per `302`
  auf `realsyncdynamics-ai.pages.dev` um.

## Ist-Zustand (gemessen am 18.11.2026 mit `curl`)

| URL | Ergebnis | Quelle |
|---|---|---|
| `https://realsyncdynamicsai.de/` | `200`, statische Seite mit `/company-voice/widget.js` | `realsync-landing` @ `c871702` |
| `https://realsyncdynamicsai.de/pricing`, `/unternehmen` und weitere | `302` auf `https://realsyncdynamics-ai.pages.dev/…` | `_redirects` auf `landing-live` (rund 40 Regeln) |
| `https://www.realsyncdynamicsai.de/` | `301` auf den Apex | |
| `http://realsyncdynamicsai.de/` | `301` auf `https` | |
| `https://realsyncdynamics-ai.pages.dev/` | `200`, Startseite v3 (`LandingV3-*.js`) | SPA @ `main` |
| `https://realsyncdynamics-ai.pages.dev/gibtsnicht` | `404` | `functions/_middleware.ts` |
| HSTS auf dem Apex | `max-age=15552000` | `realsync-landing` |
| HSTS der SPA | `max-age=31536000; includeSubDomains; preload` | `public/_headers` |

**Folge:** Seit dem Merge von #2305 ist v3 nur unter `pages.dev` zu sehen. Wer die
Domain aufruft, sieht weiter die statische Seite.

## A. Vor dem Umzug klären (Entscheidungen)

- [ ] **Unternehmens-Demo:** Die statische Seite bindet `company-voice/widget.js` ein.
      Die Startseite v3 bindet `CompanyVoiceWidget` nicht ein. Nach dem Umzug ist
      die Demo auf der Startseite nicht mehr da. Entscheiden: weglassen oder vorher
      in v3 einbauen.
- [ ] **HSTS `includeSubDomains; preload`:** Nach dem Umzug gilt der SPA-Header für
      die Domain. Dann müssen alle Subdomains per HTTPS erreichbar sein (zum Beispiel
      `chat.realsyncdynamicsai.de` und alle anderen Einträge in der DNS-Zone). Die
      Liste der Subdomains im Cloudflare-DNS prüfen.
- [ ] **Zeitfenster:** Eine Domain kann nur an einem Pages-Projekt hängen. Zwischen
      dem Entfernen und dem neuen Binden ist die Domain kurz nicht erreichbar, bis das
      Zertifikat aktiv ist (üblich: Minuten). Eine Zeit mit wenig Verkehr wählen.

## B. Vorbereitung (ohne Wirkung auf die Produktion)

- [ ] **Supabase Auth** (Dashboard → Authentication → URL Configuration):
      `https://realsyncdynamicsai.de/welcome` und `https://realsyncdynamicsai.de/**`
      zu den Redirect URLs hinzufügen. Die Einträge für `pages.dev` bleiben stehen.
      Die Site URL erst nach dem Umzug auf den Apex stellen.
- [ ] **Google OAuth** (Google Cloud Console → OAuth-Client): `https://realsyncdynamicsai.de`
      als autorisierten JavaScript-Ursprung ergänzen, falls dort Ursprünge gepflegt werden.
      Die Callback-URL bei Supabase ändert sich nicht.
- [ ] **Stripe:** Keine Änderung nötig. `stripe-checkout` nimmt die Rückkehr-URL aus dem
      `Origin`-Header. `stripe-portal` fällt auf `https://realsyncdynamicsai.de/app/billing`
      zurück.
- [ ] **CSRF und Formular-Proxy:** `realsyncdynamicsai.de` und `www` stehen schon in
      `CSRF_ALLOWED_HOSTS` (`src/lib/csrf.ts`). Auf dem Apex schicken die Formulare
      (`sales-lead`, Warteliste, Scan) ihre Anfragen dann über `/api/fn/*`. Auf
      `pages.dev` gehen sie direkt an Supabase. Der Proxy-Weg ist auf den Branch-Previews
      (`*.realsyncdynamics-ai.pages.dev`) schon in Gebrauch.
- [ ] **Bestand sichern:** In Cloudflare die Custom Domains von `realsync-landing` und die
      DNS-Einträge für Apex und `www` notieren (Screenshot). Das ist die Vorlage für den
      Rückfall.

## C. Durchführung (Cloudflare-Dashboard, nur mit Freigabe)

1. [ ] Workers & Pages → `realsync-landing` → Custom domains: `realsyncdynamicsai.de`
       und `www.realsyncdynamicsai.de` entfernen. **Das Projekt und den Branch
       `landing-live` nicht löschen.**
2. [ ] Workers & Pages → `realsyncdynamics-ai` → Custom domains: beide Domains hinzufügen.
       Cloudflare setzt die CNAME-Einträge auf `realsyncdynamics-ai.pages.dev`.
3. [ ] Warten, bis beide Domains den Status „Active“ haben und das SSL-Zertifikat
       ausgestellt ist. Hängt das: `docs/runbooks/domain-ssl-not-provisioning.md`.
4. [ ] Die Weiterleitung `www` → Apex übernimmt die erste Regel in `public/_redirects`.

## D. Prüfung direkt danach

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://realsyncdynamicsai.de/
```

Erwartet: `200`. Das HTML enthält dasselbe `assets/index-*.js` wie
`https://realsyncdynamics-ai.pages.dev/`.

```bash
for p in /pricing /unternehmen /welcome /contact-sales /audit; do printf '%s ' "$p"; curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://realsyncdynamicsai.de$p"; done
```

Erwartet: jeweils `200` und keine Weiterleitung auf `pages.dev`.

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://realsyncdynamicsai.de/gibtsnicht
```

Erwartet: `404`.

```bash
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://www.realsyncdynamicsai.de/pricing
```

Erwartet: `301` auf `https://realsyncdynamicsai.de/pricing`.

```bash
curl -sSI https://realsyncdynamicsai.de/ | grep -iE '^(strict-transport-security|content-security-policy|x-frame-options)'
```

Erwartet: die Header aus `public/_headers`.

Danach von Hand im Browser:

- [ ] Startseite v3, Klick auf „Check starten“ und den Scan bis zur Eingabe der E-Mail-Adresse.
- [ ] Login mit Google und per Magic Link. Beide müssen auf `https://realsyncdynamicsai.de/welcome` enden.
- [ ] Ein Formular auf `/contact-sales` mit einer gekennzeichneten Testadresse absenden.
      Antwort `200`, kein `403 CSRF_*`.
- [ ] `/unternehmen`: Navigation und Produkt-Dialog.
- [ ] Danach in Supabase die Site URL auf `https://realsyncdynamicsai.de` stellen.

## E. Rückfallweg

Auslöser: Die Startseite oder der Login funktioniert nicht und lässt sich nicht innerhalb
von etwa 15 Minuten beheben.

1. [ ] `realsyncdynamics-ai` → Custom domains: Apex und `www` entfernen.
2. [ ] `realsync-landing` → Custom domains: Apex und `www` wieder hinzufügen.
       Der Branch `landing-live` ist unverändert, es ist also kein neuer Build nötig.
3. [ ] Mit `curl` prüfen: `/` liefert `200` (statische Seite), `/pricing` liefert `302` auf `pages.dev`.
4. [ ] Supabase: Die Site URL zurückstellen, falls sie schon geändert wurde. Die
       zusätzlichen Redirect URLs dürfen bleiben.

Das Projekt `realsync-landing` und der Branch `landing-live` bleiben mindestens zwei Wochen
nach einem erfolgreichen Umzug bestehen.

## F. Nacharbeiten (jeweils eigener PR)

- [ ] `docs/infra/frontend-staging.md`: In der Tabelle steht der Apex dann beim Projekt
      `realsyncdynamics-ai`.
- [ ] `landing-live`: Im README vermerken, dass der Branch nur noch der Rückfall ist. Die
      302-Regeln werden dann nicht mehr gebraucht.
- [ ] Der Job „Smoke test live routes“ in `deploy-cloudflare-pages.yml` prüft gegen den Apex.
      Heute wird er übersprungen, weil der Actions-Deploy ohne Secrets nicht läuft.
- [ ] Nebenbefund, unabhängig vom Umzug: `originHostAllowed` lässt nur
      `*.realsyncdynamics-ai.pages.dev` zu, nicht die Adresse
      `realsyncdynamics-ai.pages.dev` selbst. Gemessen: Ein POST mit diesem `Origin`
      bekommt `403 CSRF_ORIGIN`. Ein bekannter Ablauf ist heute nicht betroffen, weil die
      SPA auf diesem Host den Proxy nicht benutzt (`shouldUseFnProxy()`) und
      `/api/company-voice` per GET läuft. Nach dem Umzug spielt es keine Rolle mehr.
      Die Allowlist ist sicherheitsrelevant, deshalb hier nicht geändert.
