# OAuth-Provider-Setup (Google · Microsoft · LinkedIn · GitHub)

Code-Seite ist mit PR #147 + #148 verkabelt. Damit der Login tatsächlich funktioniert,
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

## 2️⃣ Microsoft / Azure AD / Entra ID

**Pflicht für BaFin-/MaRisk-Enterprise-Kunden** (Banken, Versicherer, Behörden). Microsoft-365-Tenants wollen sich mit ihrem Firmen-Azure-AD-Konto einloggen, nicht mit privatem Gmail.

Provider-ID in Supabase: `azure`.

### A) Azure-Portal — App-Registrierung
1. https://portal.azure.com → **Microsoft Entra ID → App registrations → New registration**
2. Name: `RealSyncDynamicsAI`
3. **Supported account types:** `Accounts in any organizational directory (Multitenant) and personal Microsoft accounts` (für Workforce + B2C)
4. **Redirect URI** → Web → `https://<supabase>.supabase.co/auth/v1/callback`
5. Register → Application (client) ID kopieren
6. **Certificates & secrets → New client secret → Add** → Wert sofort kopieren (wird nur 1× gezeigt)
7. **API permissions → Add permission → Microsoft Graph → Delegated permissions:**
   - `email`
   - `openid`
   - `profile`
   - `User.Read`
8. **Grant admin consent** für die Permissions

### B) Supabase Dashboard
- Authentication → Providers → **Azure** → Enable
- Client ID + Client Secret einsetzen
- **Tenant URL:** `https://login.microsoftonline.com/common/v2.0` (für Multi-Tenant)
  - Falls nur eigener Tenant: `https://login.microsoftonline.com/<tenant-id>/v2.0`
- Save

**Verifikation:** auf `/welcome` "Mit Microsoft fortfahren" → Microsoft-Login → Consent → zurück mit Session. Email + Name aus Microsoft-Profil sind in `auth.users` verfügbar.

**Enterprise-Hinweis:** Wenn ein Kunde Conditional-Access-Policies hat (MFA-Pflicht, IP-Restriktion etc.), greifen die automatisch — Supabase muss nichts dafür konfigurieren.

---

## 3️⃣ LinkedIn

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

## 4️⃣ GitHub

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

## 5️⃣ Site-URL + Redirect-URLs in Supabase global

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
