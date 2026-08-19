# Capability Production Verification

## Contract

`src/config/platform-capabilities.ts` is the public capability registry. A capability may be `live` only when every function listed in `backedBy` is deployed in the target production Supabase project.

Repository existence tests are necessary but insufficient. Production verification must use the live project (`supabase functions list`) and record the measurement date.

## Required CI check

Before changing a capability from `building` to `live`:

1. Authenticate to the production Supabase project in a protected CI environment.
2. Run `supabase functions list` for the production project.
3. Compare deployed function names with every `backedBy` entry.
4. Fail if any required function is absent.
5. Update `CAPABILITIES_MEASURED_AT` in the same change.

Do not infer deployment from repository existence, source files, or a successful local build.

## Current limitation

The landing tests intentionally verify repository consistency only. They must not be described as proof of production deployment.
