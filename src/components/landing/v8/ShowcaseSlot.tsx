import { lazy, Suspense } from 'react';
import type { MarketingFeature } from '../../../marketing/products/types';
import { grokNoticeEnabled } from '../../../marketing/landing-v8/public-config';
import { GrokNotice } from './GrokNotice';
import { StatusBadge } from './StatusBadge';
import '../../../styles/landing-v6.css';

const GovernanceRuntimeDashboard = lazy(() =>
  import('../../../features/governance/GovernanceRuntimeDashboard').then((m) => ({
    default: m.GovernanceRuntimeDashboard,
  })),
);

const CompanyVoiceWidget = lazy(() =>
  import('../v6/CompanyVoiceWidget').then((m) => ({
    default: m.CompanyVoiceWidget,
  })),
);

export function ShowcaseSlot({
  feature,
  embed = false,
}: {
  feature: MarketingFeature | undefined;
  embed?: boolean;
}) {
  if (!feature || feature.showcase.kind === 'none') {
    return (
      <div className="v8-empty" data-testid="v8-showcase-empty">
        <StatusBadge
          feature={{
            id: 'empty',
            name: '',
            summary: '',
            status: 'in-entwicklung',
            demo: false,
            showcase: { kind: 'none' },
            evidence: '',
          }}
        />
        <p>Für diese Fläche gibt es noch keine eingebundene Ansicht. Status: in Entwicklung.</p>
      </div>
    );
  }

  return (
    <figure className="v8-slot" data-testid={`v8-showcase-${feature.id}`}>
      <figcaption className="v8-panel-head">
        <span>
          {feature.showcase.kind === 'live' && feature.showcase.component === 'governance-runtime'
            ? 'UI-Konzept · Beispieldaten'
            : feature.name}
        </span>
        <StatusBadge feature={feature} />
      </figcaption>
      {feature.showcase.kind === 'screenshot' ? (
        <img src={feature.showcase.src} alt={feature.showcase.alt} />
      ) : null}
      {feature.showcase.kind === 'live' && !embed ? (
        <p className="v8-intro">Die Demo liegt auf der Produktseite, damit sie nicht mehrfach auf der Startseite startet.</p>
      ) : null}
      {feature.showcase.kind === 'live' && embed ? (
        <Suspense fallback={<p className="v8-micro">Demo wird geladen.</p>}>
          {feature.showcase.component === 'governance-runtime' ? (
            <div className="v8-live-frame bg-obsidian-950">
              <GovernanceRuntimeDashboard />
            </div>
          ) : grokNoticeEnabled() ? (
            <div className="lv6 v8-voice-host" data-rs-theme="light" data-rs-accent="cyan">
              <GrokNotice />
              <p className="v8-micro">Demo. Die Schaltfläche unten links öffnet die Sprachdemo.</p>
              <CompanyVoiceWidget />
            </div>
          ) : (
            <p className="v8-micro">Demo. Sprachdemo ohne Anbieterhinweis.</p>
          )}
        </Suspense>
      ) : null}
    </figure>
  );
}
