# Landing token architecture

```
landing-theme.ts        primitive hex / stacks
        ↓
token-architecture.ts   semantic roles
        ↓
landing-mode.ts         var(--rsd-*), gold fallback
        ↓
landing-tokens.css      bind on :root / .landing-context / [data-landing-mode]
        ↓
HeroTitanium, chips     consume MODE_* / RSD_TOKEN only
```

Cyan is a **mode overlay** on `[data-landing-mode=cyan]`, not a second primitive set.
Plan prices and checkout URLs are **not** tokens — `shared/pricing.ts`.

Drift test: `test/landing/design-tokens.test.ts`.
