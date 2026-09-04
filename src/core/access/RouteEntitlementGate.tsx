/**
 * Route-Gate der `GovernanceBrowserShell`: liest das Zugriffsregister
 * (`featureAccess.ts`) und die wirksamen Entitlements des Mandanten
 * (`TenantProvider`, also `tenant_entitlements()` inklusive Grace Period und
 * Grants) und rendert statt der Fläche einen Upgrade-Pfad, wenn ein Key
 * fehlt.
 *
 * Verhalten in den Randfällen — bewusst zugunsten des Kunden:
 *   - Entitlements laden noch      → kurzer Ladezustand, keine Sperre
 *   - keine Entitlements ladbar     → Fläche zeigen (Demo, kein Supabase);
 *                                     die Durchsetzung bleibt serverseitig
 *   - Route nicht im Register       → Fläche zeigen
 *
 * Ein falsches „gesperrt" kostet mehr Vertrauen als ein falsches „offen":
 * Offen heißt, der Server lehnt den Aufruf ab; gesperrt heißt, ein zahlender
 * Kunde sieht sein Feature nicht.
 *
 * Optik: vorhandene Klassen der `/app`-Ansichten (vgl. ModuleUpgradeGate),
 * keine neue.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Lock, Store } from 'lucide-react';
import { planById } from '@/shared/pricing';
import { useTenant } from './TenantProvider';
import { entitlementLabel } from './entitlementLabels';
import {
  addonsCovering,
  cheapestPlanForKeys,
  decideAccess,
  requirementForPath,
  type FeatureRequirement,
} from './featureAccess';

export function RouteEntitlementGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { hasFeature, loading, entitlements } = useTenant();

  const requirement = requirementForPath(pathname);
  if (!requirement) return <>{children}</>;
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <span className="font-mono text-xs text-titanium-600">Berechtigungen werden geladen …</span>
      </div>
    );
  }
  if (!entitlements) return <>{children}</>;

  const decision = decideAccess(requirement, hasFeature);
  if (decision.allowed) return <>{children}</>;

  return <LockedFeature requirement={requirement} missing={decision.missing} />;
}

function LockedFeature({ requirement, missing }: { requirement: FeatureRequirement; missing: string[] }) {
  const plan = cheapestPlanForKeys(missing as FeatureRequirement['allOf']);
  const addons = addonsCovering(missing as FeatureRequirement['allOf']);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-obsidian-950 min-h-[320px]" data-testid="route-entitlement-gate">
      <div className="max-w-md text-center">
        <div className="w-10 h-10 bg-obsidian-800 border border-titanium-800 flex items-center justify-center mx-auto mb-4">
          <Lock className="h-5 w-5 text-titanium-500" />
        </div>
        <h2 className="font-display font-bold text-titanium-50 text-lg mb-2">
          {requirement.label} ist im aktuellen Plan nicht enthalten
        </h2>
        <p className="text-sm text-titanium-400 mb-4">
          Dafür fehlt: {missing.map(entitlementLabel).join(', ')}.
        </p>
        {plan && (
          <p className="font-mono text-[10px] uppercase tracking-widest text-titanium-600 mb-6">
            Enthalten ab {planById(plan).name}
          </p>
        )}
        {addons.length > 0 && (
          <p className="text-xs text-titanium-500 mb-6">
            Auch als Add-on buchbar: {addons.map((a) => a.name).join(', ')}.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/app/marketplace"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-400 text-obsidian-950 text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            <Store className="h-4 w-4" /> Mein Plan und Add-ons
          </Link>
          <Link
            to={plan ? `/pricing?highlight=${plan}` : '/contact-sales?source=feature-gate'}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-titanium-700 text-titanium-200 text-sm font-medium hover:border-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {plan ? 'Pläne vergleichen' : 'Angebot anfragen'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
