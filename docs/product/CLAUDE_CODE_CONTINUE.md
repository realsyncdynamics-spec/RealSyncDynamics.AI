# Claude Code — hier weitermachen

Branch: `feat/platform-os-onboarding`

## Schon da

- `shared/platform.ts` — Schichten CREATE/OPERATE/GOVERN/WORKSTORE
- `shared/onboarding.ts` + `shared/onboarding-copy.de.ts`
- `test/onboarding/onboarding.test.ts`
- `src/pages/StartOnboarding.tsx` — Q&A inkl. Möbelhaus-Spur
- `src/components/sections/PlatformOsSection.tsx` — Copy auf Landing/Pricing
- Migration `supabase/migrations/20260828230000_onboarding_profiles.sql`
- Landing und Pricing rendern die Zielarchitektur

## Noch zu verdrahten (2 Stellen in App.tsx)

```tsx
import { StartOnboarding } from './pages/StartOnboarding';
// neben der Pricing-Route:
<Route path="/start" element={<StartOnboarding />} />
```

Scan-CTA auf Audit-Erfolg: Link `/start?domain=…&source=audit`.

## Danach, in dieser Reihenfolge

1. `npm run test -- test/onboarding/onboarding.test.ts`
2. Persistenz: StartOnboarding schreibt `onboarding_profiles` (RLS).
3. Dashboard-Sektion Kanäle Aus/Test/Live + Furniture-Checkliste.
4. Policy/Bot `locked_limits` aus dem Profil.
5. Evidence-Event bei Profil-Save und Kanalwechsel.
6. Workstore-Listing `support-agent` (Install disabled ohne Entitlement).
7. Keine Price-ID-Änderung, kein Agency-self_service, keine Parallel-Vault.

## Verbote

- Preise hart in Komponenten
- `if (plan === 'growth')`
- Live ohne Checkliste + Art. 50
- Zweiter Orchestrator
