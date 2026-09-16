/**
 * Platform route: /builder/:slug/code
 * Auth + Tenant + Entitlement from existing providers. Puck remains on /builder/:slug.
 */
import { useMemo, type ReactElement } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTenant } from '../../core/access/TenantProvider';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import { useEntitlements } from '../../core/billing/useEntitlements';
import { canOpenAppBuilder, resolveBuilderEntitlements } from '../siteos/builderEntitlements';
import { BoltWorkbench } from './BoltWorkbench';
import type { GovernanceContext } from './bolt/types';

export default function BoltCodeBuilderPage(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug = 'app' } = useParams<{ slug: string }>();
  const { activeTenantId, loading: tenantLoading } = useTenant();
  const { isAuthenticated, user } = useSupabaseAuth();
  const entitlements = useEntitlements();
  const snapshot = useMemo(
    () => resolveBuilderEntitlements(entitlements.tier, entitlements.features),
    [entitlements.tier, entitlements.features],
  );
  const access = entitlements.canAccess('siteos.builder');
  const entitled = canOpenAppBuilder(snapshot);

  const ctx: GovernanceContext | null = useMemo(() => {
    if (!isAuthenticated || !activeTenantId) return null;
    return {
      tenantId: activeTenantId,
      sessionId: user?.id ?? 'session',
      actorId: user?.id ?? 'actor',
      tenantVerified: true,
      authenticated: true,
      entitlementBuilder: entitled,
    };
  }, [isAuthenticated, activeTenantId, user?.id, entitled]);

  if (!isAuthenticated) {
    navigate(`/welcome?next=${encodeURIComponent(location.pathname + location.search)}`);
    return (
      <main className="grid min-h-screen place-items-center bg-[#0A0A0B] text-[#E2E2E2]">
        Sitzung erforderlich.
      </main>
    );
  }
  if (!activeTenantId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0A0A0B] p-6 text-[#E2E2E2]">
        <p>
          {tenantLoading
            ? 'Workspace wird geladen…'
            : 'Kein verifizierter Mandant. tenant_id kommt nicht aus der URL.'}
        </p>
      </main>
    );
  }
  if (entitlements.loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0A0A0B] text-[#E2E2E2]">
        Berechtigung wird geprüft…
      </main>
    );
  }
  if (!entitled) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0A0A0B] p-6 text-[#E2E2E2]">
        <div className="grid max-w-md gap-4 text-center">
          <p className="font-mono text-[10px] tracking-[0.2em] text-[#0052FF] uppercase">RealSyncDynamics.AI</p>
          <h1 className="text-lg font-medium">Web App Builder gesperrt</h1>
          <p className="text-sm leading-6 text-white/60">
            Entitlement <code className="font-mono">siteos.builder</code> fehlt. Das Gate bleibt geschlossen — es gibt
            keinen Demo-Modus.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {access.upgradeUrl ? (
              <a href={access.upgradeUrl} className="min-h-11 bg-[#0052FF] px-4 py-3 text-sm">
                Upgrade
              </a>
            ) : null}
            <Link
              to={`/builder/${encodeURIComponent(slug)}${location.search}`}
              className="min-h-11 border border-white/15 px-4 py-3 text-sm"
            >
              Zurück zu SiteOS / Puck
            </Link>
          </div>
        </div>
      </main>
    );
  }
  if (!ctx) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0A0A0B] text-[#E2E2E2]">Gate geschlossen.</main>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E2E2E2]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-[#0052FF] uppercase">RealSyncDynamics.AI</p>
          <h1 className="text-sm font-medium">Web App Builder · {slug}</h1>
        </div>
        <Link
          to={`/builder/${encodeURIComponent(slug)}${location.search}`}
          className="inline-flex min-h-11 items-center border border-white/15 px-3 text-xs"
        >
          Zurück zu SiteOS / Puck
        </Link>
      </div>
      <BoltWorkbench ctx={ctx} projectSlug={slug} />
    </div>
  );
}
