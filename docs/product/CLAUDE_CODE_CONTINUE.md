# Claude Code — hier weitermachen

Branch: `feat/platform-os-onboarding`

Kurz nutzen: `implement the task in CLAUDE.md style`
Nicht extra sagen, dass die Datei existiert.

## Schon da

- `shared/platform.ts` — CREATE / OPERATE / GOVERN / WORKSTORE
- `shared/onboarding.ts` + Copy + Vitest
- `shared/channel-gate.ts` — fail-closed Live-Gate + Evidence-Payload
- `src/pages/StartOnboarding.tsx` — Q&A, persistiert Profil lokal
- `src/features/operate/*` — Aus/Test/Live, Checkliste, Workstore-Stub
- `PlatformOsSection` auf Landing (via LandingChannelTools) und Pricing (via RuntimePipeline)
- `/start` und `/app/channels` erreichbar über NotFoundPage-Alias

## Jetzt in App.tsx verdrahten (kanonisch)

```tsx
import { StartOnboarding } from './pages/StartOnboarding';
const OperateChannelsView = lazy(() =>
  import('./features/operate/OperateChannelsView').then((m) => ({ default: m.OperateChannelsView })),
);

<Route path="/start" element={<StartOnboarding />} />
<Route path="/pricing" element={<PricingPage />} />
<Route path="/app/channels" element={<AppGate><GovernanceBrowserShell><OperateChannelsView /></GovernanceBrowserShell></AppGate>} />
```

Danach den Alias in `NotFoundPage.tsx` entfernen.

Audit-Erfolg: Link `/start?domain=…&source=audit` in `TrialCtaBlock` / `GuidedPlanBlock`.

## Danach

1. `npm run test -- test/onboarding`
2. `onboarding_profiles` aus StartOnboarding schreiben (RLS, bestehende Migration).
3. Channel-Wechsel als Evidence-Event in den vorhandenen Vault — Event-Name `operate.channel_transition`, kein Parallel-Vault.
4. Policy/Bot `locked_limits` aus dem Profil lesen.
5. Workstore `support-agent`: Install nur über `planGrants`, nicht über Plan-Namen.
6. Keine Price-ID-Änderung, kein Agency-self_service, keine zweiten Orchestratoren.

## Verbote

- Preise hart in Komponenten
- `if (plan === 'growth')`
- Live ohne Checkliste + Art. 50
- Zweiter Orchestrator
