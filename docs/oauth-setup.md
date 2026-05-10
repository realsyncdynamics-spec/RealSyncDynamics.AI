# OAuth-Provider-Setup (Google · LinkedIn · GitHub)

Code-Seite ist mit PR #147 verkabelt. Damit der Login tatsächlich funktioniert,
müssen pro Provider 3 Schritte ausgeführt werden:

1. **OAuth-App** beim Provider anlegen + Client-ID + Secret bekommen
2. **Redirect-URI** auf Supabase-Callback eintragen
3. **Provider in Supabase-Dashboard** aktivieren + Credentials hinterlegen

Der Supabase-Callback-URL ist immer:
```
https://<dein-supabase-project>.supabase.co/auth/v1/callback
```

---

## 1️⃣ Google

### A) Google-Cloud-Console
1. https://console.cloud.google.com/ → Project anlegen (z.B. `realsyncdynamicsai-prod`)
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
3. Application type: `Web application`
4. Name: `RealSyncDynamicsAI`
5. **Authorized redirect URIs:** `https://<supabase>.supabase.co/auth/v1/callback`
6. Client-ID + Client-Secret kopieren

### B) OAuth Consent Screen konfigurieren
1. **APIs & Services → OAuth consent screen**
2. User Type: `External`
3. App-Name: `RealSyncDynamicsAI`
4. User support email: `hello@realsyncdynamicsai.de`
5. Developer contact: deine Email
6. Authorized domains: `realsyncdynamicsai.de`
7. Scopes: `email`, `profile`, `openid` (Default reicht)

### C) Supabase Dashboard
- Authentication → Providers → Google → Enable
- Client-ID + Client-Secret einsetzen → Save

**Verifikation:** auf `/welcome` "Mit Google fortfahren" klicken → Google-Consent-Screen → zurück mit Session.

---

## 2️⃣ LinkedIn

⚠️ LinkedIn-OAuth braucht **OpenID-Connect** (nicht das alte LinkedIn v2). Provider-ID in Supabase: `linkedin_oidc`.

### A) LinkedIn-Developer-Portal
1. https://www.linkedin.com/developers/apps/new
2. App-Name: `RealSyncDynamicsAI`
3. LinkedIn-Page: deine Firmen-Page (oder Create-New)
4. App-Logo hochladen (offizielles Logo)
5. **Products → Sign In with LinkedIn using OpenID Connect** anfordern (manchmal sofortige Freigabe)
6. **Auth → Authorized redirect URLs:** `https://<supabase>.supabase.co/auth/v1/callback`
7. Client-ID + Client-Secret kopieren

### B) Supabase Dashboard
- Authentication → Providers → LinkedIn (OIDC) → Enable
- Client-ID + Client-Secret → Save

**Verifikation:** auf `/welcome` "Mit LinkedIn fortfahren" → LinkedIn-Consent → zurück.

---

## 3️⃣ GitHub

### A) GitHub
1. https://github.com/settings/developers → **OAuth Apps → New OAuth App**
2. Application name: `RealSyncDynamicsAI`
3. Homepage URL: `https://realsyncdynamicsai.de`
4. **Authorization callback URL:** `https://<supabase>.supabase.co/auth/v1/callback`
5. Register application → Client-ID notieren
6. **Generate a new client secret** → kopieren (wird nur 1× gezeigt!)

### B) Supabase Dashboard
- Authentication → Providers → GitHub → Enable
- Client-ID + Client-Secret → Save

**Verifikation:** auf `/welcome` "Mit GitHub fortfahren" → GitHub-Authorize → zurück.

---

## 4️⃣ Site-URL + Redirect-URLs in Supabase global

Nicht-pro-Provider, aber Pflicht:

**Authentication → URL Configuration:**
- **Site URL:** `https://realsyncdynamicsai.de`
- **Additional Redirect URLs:** (eine pro Zeile)
  ```
  https://realsyncdynamicsai.de/**
  http://localhost:5173/**
  http://localhost:3000/**
  ```

Ohne diese Whitelist verweigert Supabase den Redirect zurück nach OAuth.

---

## End-to-End-Test pro Provider

```
1. realsyncdynamicsai.de/welcome
2. Klick "Mit Google fortfahren" (oder LinkedIn / GitHub)
3. Provider-Consent-Screen
4. Redirect zurück nach /welcome (mit Session)
5. Wizard läuft durch (Tenant-Setup automatisch via DB-Trigger)
6. Bei ?next=/checkout/starter: nach Step 4 navigate auf /checkout/starter
```

---

## Troubleshooting

**Error: "Unable to exchange external code"**
→ Redirect-URI in Provider-OAuth-App stimmt nicht mit Supabase-Callback überein. Exakt `https://<supabase>.supabase.co/auth/v1/callback` (kein Trailing-Slash).

**Error: "Invalid login credentials"**
→ Client-ID oder Client-Secret im Supabase-Dashboard sind falsch eingetragen. Beim erneuten Speichern frisch reinkopieren.

**Error: "redirect_uri_mismatch"**
→ Site-URL + Additional Redirect URLs in Supabase-Auth-Config nicht gesetzt (siehe Punkt 4).

**LinkedIn: "OAuth flow failed"**
→ Wahrscheinlich verwendest du den alten "Sign In with LinkedIn"-Provider statt OIDC. Supabase erwartet `linkedin_oidc`. In der App "Sign In with LinkedIn using OpenID Connect" Product anfordern.

**Google: "Access blocked: This app's request is invalid"**
→ OAuth Consent Screen steht in "Testing"-Mode → publish-Live setzen, oder User als Test-User adden.
