/**
 * Dark / Gold / Cream upgrade surface for /build when `siteos.builder` is missing
 * or `limit.sites` is exhausted. Self-service checkout or Enterprise anfragen only.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Sparkles } from 'lucide-react';
import { OS_CREAM_BTN } from '../../components/governance-os/osChrome';
import { STATUS_LABEL } from '../../product/implementation-status';
import {
  builderUpgradeHref,
  type BuilderEntitlementSnapshot,
} from './builderEntitlements';

export interface BuilderUpgradePanelProps {
  snapshot: BuilderEntitlementSnapshot;
  reason: 'no_entitlement' | 'sites_exhausted' | 'publish_locked';
  /** Optional override (e.g. from useEntitlements().canAccess). */
  upgradeHref?: string;
}

const COPY: Record<BuilderUpgradePanelProps['reason'], { title: string; body: string }> = {
  no_entitlement: {
    title: 'App Builder ist in Ihrem Plan nicht enthalten',
    body:
      'Der DSGVO Web App Builder gehört ab Starter zur Governance Runtime ' +
      '(Berechtigung siteos.builder). Ohne Freischaltung bleibt das Studio gesperrt — ' +
      'kein Fehler, kein Fake-Zugang.',
  },
  sites_exhausted: {
    title: 'Site-Kontingent erreicht',
    body:
      'Ihr Plan erlaubt keine weitere SiteOS-Site (limit.sites). Upgrade hebt die Grenze an. ' +
      'Überwachte Domains (Monitoring) sind ein separates Kontingent.',
  },
  publish_locked: {
    title: 'Veröffentlichung nicht freigeschaltet',
    body:
      'Publish-Freigabe (siteos.publish) fehlt in Ihrem Plan. Öffentliches Deploy bleibt ' +
      `${STATUS_LABEL.preview} — wir simulieren keinen erfolgreichen Deploy.`,
  },
};

export function BuilderUpgradePanel({
  snapshot,
  reason,
  upgradeHref,
}: BuilderUpgradePanelProps) {
  const copy = COPY[reason];
  const href = upgradeHref ?? builderUpgradeHref(snapshot.planId);
  const isEnterpriseInquiry = href.includes('/contact-sales');

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center bg-obsidian-950 px-6 py-16 text-center"
      data-testid="builder-upgrade-panel"
      data-reason={reason}
    >
      <div className="mb-5 grid h-12 w-12 place-items-center border border-[#e4cfa2]/40 bg-[#e4cfa2]/10 text-[#e4cfa2]">
        <Lock size={20} aria-hidden />
      </div>
      <span className="mb-3 font-mono text-[9px] uppercase tracking-widest text-[#e4cfa2]">
        Governance OS · {STATUS_LABEL.preview}
      </span>
      <h1 className="font-display max-w-lg text-2xl font-semibold text-titanium-50">
        {copy.title}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-titanium-400">{copy.body}</p>

      {snapshot.planName && (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-titanium-600">
          Aktueller Plan · {snapshot.planName}
          {snapshot.ssotReady && (
            <>
              {' '}
              · Sites {snapshot.sites === -1 ? '∞' : snapshot.sites}
              {' · '}
              Builder {snapshot.builder ? 'an' : 'aus'}
              {' · '}
              Publish {snapshot.publish ? 'an' : 'aus'}
            </>
          )}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to={href}
          className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold uppercase tracking-wider ${OS_CREAM_BTN}`}
          data-testid="builder-upgrade-cta"
        >
          {isEnterpriseInquiry ? 'Enterprise anfragen' : 'Plan freischalten'}
          <ArrowRight size={14} />
        </Link>
        <Link
          to="/app"
          className="inline-flex items-center gap-2 border border-titanium-700 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-titanium-300 hover:border-[#e4cfa2]/40 hover:text-[#e4cfa2]"
        >
          <Sparkles size={12} /> Command Center
        </Link>
      </div>
    </div>
  );
}
