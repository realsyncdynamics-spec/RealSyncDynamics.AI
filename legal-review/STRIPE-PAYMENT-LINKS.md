# Stripe Payment Links — RealSync Dynamics

Erzeugt am: 2026-05-07 · Stripe-Account: `acct_1Sr3lpCNKcHrCAIC` (realsyncdynamics.de · Live-Mode)

## Cookie-SDK Pro — 49 €/Monat (recurring)

- **Product ID:** `prod_UTP4G3iK90n8OC`
- **Price ID:** `price_1TUSeTCNKcHrCAICVtkcShzE`
- **Payment Link ID:** `plink_1TUSf1CNKcHrCAICcS7Xd07l`
- **Payment Link URL:** https://buy.stripe.com/5kQ6oGeQK44L3Uv3PD8og0f

Description (Stripe-side): Embedbares Cookie-Consent-SDK (BfDI 2024 konform, 1-Zeile-Embed, i18n DE/EN, 3 gleichberechtigte Buttons, Audit-Log + Export). DACH-Pricing für stack-agnostisches Cookie-Banner — alternative zu OneTrust/Usercentrics/Cookiebot. Inklusive: Snippet, Audit-Log, AVV-Vorlage. EU-Hosted in Frankfurt.

## Audit-Pro — 499 € (Einmalkauf)

- **Product ID:** `prod_UTPU1w1h8eAzpE`
- **Price ID:** `price_1TUSfHCNKcHrCAICp2yOj4HC`
- **Payment Link ID:** `plink_1TUSfXCNKcHrCAICl8XJuIox`
- **Payment Link URL:** https://buy.stripe.com/4gM00icIC44L76HgCp8og0g

Description (Stripe-side): Premium-DSGVO-Audit für eine Domain — manuelle Tiefenprüfung mit DSGVO-Score, BfDI-2024-Cookie-Banner-Check, Subpages-Scan, Sub-Processor-Identifikation, Schrems-II-Risiko-Bewertung, schriftlicher Maßnahmen-Liste. Einmalkauf 499 €. Bericht innerhalb 5 Werktagen.

## Wo einbauen

Beide Payment-Link-URLs auf den Landing-Pages als CTA-Buttons:

- `/cookie-consent-sdk` (Cookie-SDK Pro Page) → "Jetzt buchen" Button → Cookie-SDK-URL
- `/audit-pro` (Audit-Pro Page) → "Audit beauftragen" Button → Audit-Pro-URL

Empfehlung: in einer separaten kleinen Iteration via Edit auf den beiden Page-Files den Button-href setzen — entfernt das Bedürfnis, Stripe-Checkout-Endpoints aufzubauen für diese beiden eigenständigen Produkte.

## Hinweis zur Steuer

USt-IdNr ist noch nicht im Impressum eingetragen (kommt nach Finanzamt-Fragebogen). Bei den ersten Verkäufen über die Payment-Links erfolgt die Rechnungsstellung über Stripe — Steuer-Status muss vorab im Stripe-Dashboard hinterlegt werden:

1. https://dashboard.stripe.com/settings/tax
2. Tax-Behavior auf "Inclusive" oder "Exclusive" setzen, abhängig von Kleinunternehmer-Status (§ 19 UStG)
3. Bei Kleinunternehmer-Regelung: Tax-Rate 0 % mit Hinweis "§ 19 UStG"
4. Sobald USt-IdNr vergeben: Stripe-Tax aktivieren, Reverse-Charge-Pattern für B2B-EU-Kunden konfigurieren

## Disclaimer

Die Payment-Links sind im Stripe-Live-Mode angelegt. Bei der ersten Buchung wird die Live-Auszahlung an dein Bankkonto getriggert. Bevor du die URLs öffentlich auf der Website verlinkst, prüfe:

- Stripe-Dashboard: https://dashboard.stripe.com/payments → erste Test-Buchung mit echter Karte machen, dann ggf. Refund
- Stripe-Tax-Settings (siehe oben)
- Bankverbindung im Stripe-Dashboard verifiziert
