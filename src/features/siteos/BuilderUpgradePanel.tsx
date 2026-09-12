/**
 * Dark / Gold / Cream upgrade surface for /build when appBuilder is missing.
 * Self-service checkout or Enterprise anfragen only — no outbound contact CTAs.
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
  reason: 'no_entitlement' | 'runs_exhausted' | 'sites_exhausted' | 'designer_locked';
  /** Optional override (e.g. next plan after current). */
  upgradeHref?: string;
}

const COPY: Record<BuilderUpgradePanelProps['reason'], { title: string; body: string }> = {
  no_entitlement: {
    title: 'App Builder ist in Ihrem Plan nicht enthalten',
    body:
      'Der DSGVO Web App Builder gehört ab Starter zur Governance Runtime. ' +
      'Ohne Freischaltung bleibt das Studio gesperrt — kein Fehler, kein Fake-Zugang.',
  },
  runs_exhausted: {
    title: 'Monatliches Builder-Kontingent erreicht',
    body:
      'Weitere Builder-Läufe sind in diesem Abrechnungszeitraum nicht freigeschaltet. ' +
      'Upgrade erhöht das Kontingent — wir simulieren keinen erfolgreichen Lauf.',
  },
  sites_exhausted: {
    title: 'Site-Kontingent erreicht',
    body:
      'Ihr Plan erlaubt keine weitere SiteOS-Site. Upgrade hebt die Grenze an. ' +
      'Überwachte Domains (Monitoring) sind ein separates Kontingent.',
  },
  designer_locked: {
    title: 'Frontend Designer ab Growth',
    body:
      'Der visuelle Canvas (Layout, Typo, Dark/Gold/Cream-Tokens) ist ab Growth freigeschaltet. ' +
      'App Builder bleibt nutzbar, sofern Ihr Plan ihn enthält.',
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
              Läufe/Monat{' '}
              {snapshot.builderRunsPerMonth === -1 ? '∞' : snapshot.builderRunsPerMonth}
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
