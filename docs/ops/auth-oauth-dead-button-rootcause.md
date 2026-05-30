# Root-Cause: OAuth-„Dead-Button" / Auth-401-Symptome

> Analyse im Rahmen der Auth-Stabilisierung. Branch: `claude/auth-oauth-dead-button-fix`.
> Read-only untersucht; ein minimaler, isolierter Code-Fix ist enthalten (s. §4).

## 1 · Symptom

Im Auth-Log (vgl. PR #416) erscheinen für `/authorize`-Calls aus `Welcome.tsx`
und `CheckoutPage.tsx`:

```
error_code: validation_failed
msg:        "400: Unsupported provider: provider is not enabled"
```

In der UI endet der Klick auf einem OAuth-Button in einer roten Roh-Fehlermeldung
ohne Ausweg — der häufigste „Login funktioniert nicht"-Report.

> **Wichtige Einordnung:** Das ist streng genommen **kein HTTP 401**, sondern ein
> **400 `validation_failed`** vom Supabase-Auth-Endpoint. Echte 401 (abgelaufener /
> fehlender Bearer) treten separat bei Edge-Function-Calls auf — siehe §5.

## 2 · Ursache (Root Cause)

Die OAuth-Buttons werden **opt-out** gerendert: `OAuthProviderButtons.tsx`
setzte alle vier Provider (`google`, `azure`, `linkedin_oidc`, `github`) per
Default auf sichtbar (`flagOn` = „an, außer explizit `false`"). Ein Provider
funktioniert aber **erst nach manueller 3-Schritt-Aktivierung im
Supabase-Dashboard** (siehe `docs/oauth-setup.md`).

→ Jeder Provider, der in der UI sichtbar, aber im Dashboard **noch nicht
aktiviert** ist, liefert `validation_failed: provider is not enabled`.

### Verschärfende Faktoren

1. **Default-on für alle.** Ein frischer oder nur teilweise konfigurierter Stack
   zeigt Buttons für Provider, die es serverseitig (noch) nicht gibt.
2. **Intent-Drift bei Microsoft/Azure.** Der Datei-Header dokumentierte Microsoft
   ausdrücklich als „kommt mit Enterprise-Folge-PR / bewusst nicht enthalten" —
   der Provider stand aber trotzdem im `PROVIDERS`-Array **und** auf
   default-sichtbar. Azure ist damit der wahrscheinlichste Dead-Button.
3. **Roh-Fehler-Passthrough.** `handleProviderClick` zeigt `err.message` direkt an
   (kein Klassifizieren, kein Verweis auf den funktionierenden Magic-Link, kein
   Per-Session-Deaktivieren des toten Buttons). → Das adressiert **PR #416**
   (aktuell `dirty`/ungemerged) bereits umfassend; hier bewusst nicht dupliziert.

### Was NICHT die Ursache ist

- Magic-Link (`signInWithOtp` in `Welcome.tsx`) funktioniert unabhängig davon —
  **der Signup-Pfad ist also nicht vollständig blockiert**, nur der prominenteste
  CTA (OAuth oben) kann ins Leere laufen und kostet Conversion.
- `getSupabase()`-Singleton + Session-Persistenz sind korrekt konfiguriert
  (`persistSession`/`autoRefreshToken`/`detectSessionInUrl` = true).

## 3 · Sofort-Fix ohne Deploy (empfohlen, schnellster Hebel)

Im Hosting-Dashboard (Vite-Env) für **jeden noch nicht im Supabase-Dashboard
aktivierten Provider** das Flag setzen — wirkt sofort, kein Code, kein Deploy:

```
VITE_AUTH_AZURE_ENABLED=false      # falls Microsoft noch nicht aktiviert
VITE_AUTH_LINKEDIN_ENABLED=false   # falls LinkedIn noch nicht aktiviert
VITE_AUTH_GITHUB_ENABLED=false     # falls GitHub noch nicht aktiviert
# Google standardmäßig sichtbar lassen, wenn im Dashboard aktiviert.
```

→ Es bleiben nur Buttons übrig, die tatsächlich funktionieren. Rest: Magic-Link.

## 4 · Enthaltener Code-Fix (minimal, isoliert)

`src/features/auth/OAuthProviderButtons.tsx`:

- **Microsoft/Azure von default-on auf opt-IN** umgestellt (neuer Helfer
  `flagOptIn` — nur sichtbar bei explizitem `VITE_AUTH_AZURE_ENABLED=true`).
  Beseitigt den wahrscheinlichsten Dead-Button und löst den Header-Widerspruch
  (Header sagte „nicht enthalten", Code zeigte ihn).
- Google / LinkedIn / GitHub bleiben default-on (intendiertes Live-Set).
- Header-Doku entsprechend korrigiert.

Bewusst **nicht** hier (gehört in PR #416): Fehler-Klassifizierung +
Per-Session-Disable + freundliche Magic-Link-Weiterleitung.

## 5 · Eigentliche Auflösung (operativ)

Pro produktiv gewünschtem Provider die 3 Schritte aus `docs/oauth-setup.md`
ausführen (OAuth-App anlegen → Redirect-URI → Supabase-Provider aktivieren),
plus **§5 dort**: Site-URL + Additional-Redirect-URLs in der Supabase-Auth-Config
setzen (sonst `redirect_uri_mismatch`).

## 6 · Empfohlene Reihenfolge

1. **Jetzt:** Env-Flags für nicht-aktivierte Provider auf `false` (§3) — Dead-Buttons weg.
2. **Diesen Fix** reviewen/mergen (azure opt-in) — strukturelle Absicherung.
3. **PR #416 rebasen + mergen** — graceful Fehler-UX.
4. **Provider scharf schalten** nach `docs/oauth-setup.md`, sobald gewünscht.

## 7 · Separater Punkt: echte 401 bei Edge Functions

Unabhängig vom OAuth-Thema: API-Calls aus dem SPA (`sb.functions.invoke(...)`)
tragen den Session-JWT automatisch. Ein 401 dort bedeutet abgelaufene/fehlende
Session — Mapping z. B. in `stripeDiagnostics.ts` (`unauthorized|401 → missing_user`).
Falls hier konkrete Reports vorliegen, lohnt eine separate Analyse (Token-Refresh
beim Tab-Wiederkehr, RLS-Policy-Treffer). Nicht Teil dieses Fixes.
