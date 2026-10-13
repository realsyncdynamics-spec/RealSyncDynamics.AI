// Deno-Verdrahtung der Rebuild-Handler (`handlers/rebuild.ts`).
//
// Die Handler bekommen Resolver und Plan-Schranken herein, damit sie selbst
// keine `jsr:`-Abhängigkeit haben und in Vitest laufen. Hier — und nur hier —
// steht, was in Produktion eingesetzt wird: der kanonische Resolver
// `requireAuthAndTenant` und die SiteOS-Plan-Schranken. Der Quelltext-Vertrag
// in `test/security/siteos-rebuild-auth.test.ts` hält das fest.

import { requireAuthAndTenant } from '../_shared/auth.ts';
import { gateSiteCreate, gateSiteEdit } from './site-entitlements.ts';
import type { RebuildDeps } from './handlers/rebuild.ts';

export const REBUILD_DEPS: RebuildDeps = Object.freeze({ requireAuthAndTenant, gateSiteEdit, gateSiteCreate });
