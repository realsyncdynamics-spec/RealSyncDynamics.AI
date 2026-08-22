# siteos-preview

Liefert erzeugte SiteOS-Vorschauen von einer **eigenen Herkunft** aus.

## Warum

Auf dieser Herkunft läuft Code, den nicht wir geschrieben haben — erzeugt aus
der Beschreibung oder den Inhalten eines Kunden. Läge er im Dokumentbaum der
Anwendung, könnte er an deren `localStorage` und damit an die Supabase-Sitzung.

Eine eigene Herkunft löst drei Dinge, die im Frontend nicht lösbar sind:

1. Die Trennung ist eine Eigenschaft der **Auslieferung**, nicht eines
   Attributs, das jemand versehentlich ändert.
2. `frame-ancestors` wirkt nur als HTTP-Header. Ohne eigene Auslieferung
   lässt sich nicht begrenzen, wer eine Vorschau einbetten darf.
3. Eine Vorschau bekommt eine **Adresse** — Voraussetzung dafür, dass jemand
   sie teilen oder später wieder aufrufen kann.

## Was er nicht tut

Er erzeugt nichts, kennt weder Modell noch Blueprint noch Mandanten und hat
keinen Zugriff auf Supabase, Stripe oder ein Geheimnis der Anwendung. Er nimmt
fertiges HTML entgegen und gibt es wieder aus. Diese Enge ist der Zweck.

## Herkunft

`workers_dev: true` vergibt `siteos-preview.<account>.workers.dev`. Das ist
bereits eine eigene Registrierdomain — die Trennung wirkt **sofort, ohne
DNS-Eintrag**.

Eine eigene Subdomain (`preview.realsyncdynamicsai.de`) kommt später als
`routes`-Eintrag dazu. Sie verbessert die Lesbarkeit und die spätere Anbindung
eigener Kundendomains, **nicht** die Sicherheit — die steht schon.

## Schnittstelle

| | |
|---|---|
| `GET /p/{id}` | Vorschau ausliefern, mit CSP, `nosniff`, `no-referrer`, `no-store`, `noindex` |
| `HEAD /p/{id}` | dasselbe ohne Rumpf |
| `PUT /p/{id}` | Dokument ablegen — `Authorization: Bearer <PREVIEW_WRITE_TOKEN>` |
| `DELETE /p/{id}` | Dokument entfernen — dasselbe Geheimnis |
| `GET /healthz` | Lebenszeichen |

`{id}` sind 32 Hex-Zeichen (128 Bit aus `crypto.getRandomValues`). Bei einem
anonymen Entwurf ist die Kennung der **einzige** Zugangsschutz; sie wird vor
jedem Speicherzugriff geprüft.

Nicht gefunden und abgelaufen liefern dieselbe Antwort — sonst liesse sich
über die Statuscodes herausfinden, welche Kennungen es einmal gab.

## Ablage

Cloudflare KV mit `expirationTtl`. Ein anonymer Entwurf gehört zu **keinem**
Mandanten; ihn nach `public.*` zu schreiben hiesse, eine Zeile ohne
`tenant_id` in ein Schema zu legen, das genau darauf aufbaut — RLS hätte
nichts, woran sie greifen könnte. KV passt zur Sache: ohne Kennung
unauffindbar, verfällt von selbst.

Der Verfall (`ANONYMOUS_PREVIEW_TTL_SECONDS`, 7 Tage) ist zugleich die Antwort
auf DSGVO Art. 5 Abs. 1 lit. e für Inhalte, die jemand ohne Konto hinterlässt.
Beim Project Claim wandert der Entwurf in die Datenbank und bekommt dort
Mandant, RLS und Prüfpfad.

## Einrichtung vor dem ersten Deploy

```bash
npx wrangler kv namespace create PREVIEWS
# ausgegebene id in wrangler.jsonc eintragen

npx wrangler secret put PREVIEW_WRITE_TOKEN --config workers/siteos-preview/wrangler.jsonc
# denselben Wert als Repo-Secret hinterlegen
```

Solange die KV-Kennung der Platzhalter ist, überspringt sich der Workflow
`.github/workflows/deploy-siteos-preview.yml` selbst. Ein Deploy gegen eine
nicht existierende Ablage wäre ein Worker, der jede Vorschau als „nicht
gefunden" beantwortet — schlimmer als kein Deploy.

## Eine Quelle für die Richtlinien

CSP, Header, Kennungsformat und Verfall stehen in
`src/lib/preview-sandbox.ts` — derselben Datei, aus der auch die eingebettete
`srcDoc`-Vorschau ihre Richtlinien bezieht. Es soll genau **eine** Antwort
darauf geben, was eine Vorschau darf.

Geprüft in `test/security/preview-sandbox.test.ts` (Richtlinien) und
`test/security/siteos-preview-worker.test.ts` (Verhalten: Autorisierung,
Eingabeprüfung, Header).
