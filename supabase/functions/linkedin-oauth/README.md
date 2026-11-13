# linkedin-oauth

Serverseitiger LinkedIn-OAuth-2.0-Flow (Authorization Code, 3-legged) für das Social Studio.

Die Function tauscht den Authorization Code selbst und schreibt Access- und gegebenenfalls Refresh-Token nur versiegelt nach `social_channel_connections.credentials_enc` (`secretBox`, AES-256-GCM). Der Browser sieht weder Token noch Client-Secret.

Kein Merge und kein Deploy ohne Freigabe. Diese Function ist im Repo, nicht in der Produktionsliste.

## Schritte

1. `POST /functions/v1/linkedin-oauth` mit Nutzer-JWT und `{ "op": "start", "tenant_id": "<uuid>", "return_to": "<optional>" }`.
   Rolle `owner` oder `admin` im Mandanten (`requireAuthAndTenant`, dieselbe Mitgliedschaft wie `social-channel-connect`).
2. Antwort: `{ "ok": true, "authorization_url": "https://www.linkedin.com/oauth/v2/authorization?..." }`.
   Der Browser geht auf diese URL. `redirect_uri` darin ist immer `LINKEDIN_OAUTH_REDIRECT_URI`, nie ein Request-Feld.
3. LinkedIn leitet den Browser auf die Redirect-URI (diese Function, `GET`) mit `code` und `state`, oder mit `error` und `state`.
4. Die Function prüft den State (vorhanden, nicht abgelaufen, nicht wiederverwendet, Mandant aus dem State). Sie tauscht `code` per `POST https://www.linkedin.com/oauth/v2/accessToken` und liest die Member-ID per `GET https://api.linkedin.com/v2/userinfo` (`sub`).
5. Speichern: `account_external_id = urn:li:person:<sub>`, Tokens nur im Siegel, Ablauf in `token_expires_at`. Status `connected` erst nach erfolgreichem Audit. Schlägt das Audit fehl, nimmt `commitWithAudit` die Schreibe zurück; die Antwort ist kein Erfolg.
6. Redirect auf die beim Start geprüfte Frontend-URL: `?linkedin=connected` oder `?linkedin=error&reason=<generisch>`. Kein `code`, kein Token. `Referrer-Policy: no-referrer`, damit der Code nicht als Referer an die App geht.

`verify_jwt` ist `false`, weil LinkedIn beim Redirect kein Supabase-JWT senden kann. `start` prüft das JWT selbst. `callback` akzeptiert keinen Mandanten aus der Query als Schreibziel.

## Umgebungsvariablen

Nur Namen. Werte setzt Dominik in den Edge-Function-Secrets. Keine echten Werte ins Repo, ins Frontend oder in Beispieldateien.

| Name | Bedeutung |
|---|---|
| `LINKEDIN_CLIENT_ID` | Client ID der LinkedIn-App. Steht in der Authorization-URL, nicht im Frontend-Bundle. |
| `LINKEDIN_CLIENT_SECRET` | Client Secret. Nur beim Token-Tausch, nie in Antwort oder Log. |
| `LINKEDIN_OAUTH_REDIRECT_URI` | Absolute `https`-URL dieser Function, ohne Query und ohne Fragment. Muss exakt im LinkedIn-Developer-Portal stehen. |
| `LINKEDIN_OAUTH_RETURN_URLS` | Kommagetrennte Allowlist der Frontend-Rücksprungseiten. `https`, oder `http` nur für `localhost` / `127.0.0.1`. |
| `LINKEDIN_ORG_SCOPES` | Exakt `on` hängt `w_organization_social` an. Jeder andere Wert, auch leer, lässt den Scope weg. |
| `INTEGRATION_CREDENTIALS_KEY` | Bestehendes Siegel für `credentials_enc`. Ohne Schlüssel wird nichts gespeichert. |

`return_to` im Start-Body wird nur akzeptiert, wenn der Wert exakt in `LINKEDIN_OAUTH_RETURN_URLS` steht. Fehlt er und die Liste hat genau einen Eintrag, wird dieser genommen.

## Scopes

Standard: `openid profile w_member_social`.

Mit `LINKEDIN_ORG_SCOPES=on` zusätzlich `w_organization_social`. Das ist keine Zusage, dass der Scope für die App freigeschaltet ist. Organisations-Auswahl ist in dieser Function nicht gebaut.

## LinkedIn-App und Voraussetzungen

Im [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps) (Auth-Tab):

- Client ID und Client Secret anlegen. Das Secret nur als Edge-Secret setzen.
- Redirect-URL exakt als `LINKEDIN_OAUTH_REDIRECT_URI` eintragen. LinkedIn verlangt absolute `https`-URLs, ignoriert Query-Parameter und verbietet Fragmente.
- Produkt **Sign In with LinkedIn using OpenID Connect** für `openid` und `profile` sowie den Userinfo-Endpoint. Ohne dieses Produkt liefert LinkedIn `invalid scope` bzw. kein `sub`.
- Produkt für `w_member_social` (Share on LinkedIn / Mitgliedsbeiträge). Ob die App das Produkt hat, ist hier nicht geprüft.
- `w_organization_social` nur nach Freischaltung der **Community Management API**. Default aus. Nichts davon als verfügbar behandeln.

Dokumentierte Endpunkte, keine weiteren:

- [Authorization Code Flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [Sign In with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) (Discovery nennt `userinfo_endpoint` `https://api.linkedin.com/v2/userinfo`)

## Anbindung aus PR #2214

Das Panel `SocialChannelConnectPanel` liegt auf `feat/social-studio-connect-widget` und wird hier nicht geändert. Verbinden und Rotieren rufen denselben Helfer auf, weil der Callback die Zeile zur Member-URN aktualisiert:

```ts
import { startLinkedInOAuth } from '../../social-studio/linkedinOAuth';

onClick={() => { void startLinkedInOAuth(tenantId).catch(() => setPlaceholder('LinkedIn-Verbindung konnte nicht gestartet werden.')); }}
```

Der Helfer lehnt jede Authorization-URL ab, die nicht `https://www.linkedin.com/oauth/v2/authorization` ist. Nach dem Redirect liest die Seite `linkedin=connected` oder `linkedin=error` mit `reason` aus `denied`, `state`, `token`, `profile`, `forbidden`, `store`, `audit`, `config`. Der LinkedIn-`code` darf nicht an die SPA durchgereicht werden: `detectSessionInUrl` würde ihn als Supabase-PKCE-Code lesen.

## Offene Punkte

- OIDC-Discovery nennt `subject_types_supported: pairwise`. Das Beispiel für `sub` ist `782bbtaQ`. Es ist nicht dokumentiert, dass dieser Wert die Personen-ID in `urn:li:person:` ist, die die Posts API erwartet. Gespeichert wird trotzdem `urn:li:person:<sub>`, wie beauftragt. Ein anderes Auflösen wäre eine zusätzliche API und ist hier nicht gebaut. Der Branch `fix/social-publisher-linkedin-posts-api` bleibt unberührt. Veröffentlichen bleibt hinter `SOCIAL_PUBLISHER_LINKEDIN_ENABLED` (Default aus).
- Programmatische Refresh Tokens sind laut Authorization-Code-Flow nur für einen begrenzten Partnerkreis. `refresh_token` wird nur ins Siegel geschrieben, wenn die Token-Antwort ihn enthält. Ein Refresh-Grant wird hier nicht aufgerufen. Für die übrigen Apps beschreibt LinkedIn das erneute Durchlaufen der Authorization.
- `refresh_token_expires_in` hat keine Spalte und wird nicht gespeichert.
- `expires_in` muss eine JSON-Zahl sein. Ein String wird abgelehnt.
- Fehlt `scope` in der Token-Antwort, oder weicht es von den beim Start angeforderten Scopes ab, wird nichts gespeichert.
- Die ID-Token-Prüfung ist nicht gebaut. Die Member-ID kommt aus Userinfo, das ID-Token wird nicht gespeichert.
- `connector_registry.status` bleibt `pending`, analog zu `social-channel-connect`. Die Klasse ist `C` über `system_type = social_channel`. Ob die Registratur nach dem Tausch auf `connected` springt, ist offen.
- Abgelaufene State-Zeilen löscht kein Cron. Die Tabelle enthält keine Tokens.
- `actor_email` im Audit ist auf dem Callback leer, weil LinkedIn kein Nutzer-JWT zurückschickt. `actor_user_id` kommt aus dem State.

## Fehler

Provider-`error` / `error_description`, abgelaufener oder wiederverwendeter State und ein fehlgeschlagener Token-Tausch werden nicht mit Geheimnissen geloggt. Der Browser sieht nur den generischen `reason`. `error_description` wird nicht weitergereicht.
