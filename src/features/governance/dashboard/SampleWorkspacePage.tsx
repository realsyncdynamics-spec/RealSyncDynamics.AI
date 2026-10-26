/**
 * /app/beispiel — das Dashboard mit erfundenen Beispieldaten (WP-4).
 *
 * Zeigt Startansicht und Cockpit so, wie sie mit eingerichteter Website,
 * Scan, KI-Systemen und Aktivierung aussehen. Liest und schreibt nichts:
 * Daten kommen aus sampleWorkspace.ts. Der Hinweis oben bleibt sichtbar,
 * solange die Seite offen ist.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CustomerStartPanel } from './CustomerStartPanel';
import { ComplianceStatusView } from './ComplianceStatusDashboard';
import { computeStartPanel } from './startPanelModel';
import {
  SAMPLE_TENANT_NAME,
  buildSampleCockpitData,
  buildSampleComplianceKpi,
  buildSampleStartFacts,
} from './sampleWorkspace';
import './sample-workspace.css';

/** Platzhalter statt einer Mandanten-ID — die Ansicht lädt damit nichts. */
const SAMPLE_VIEW_ID = 'beispiel';

export function SampleWorkspacePage() {
  const now = useMemo(() => Date.now(), []);
  const data = useMemo(() => buildSampleCockpitData(now), [now]);
  const complianceKpi = useMemo(() => buildSampleComplianceKpi(now), [now]);
  const facts = useMemo(() => buildSampleStartFacts(data), [data]);
  const model = useMemo(() => computeStartPanel(facts), [facts]);

  return (
    <div className="rs-sample" data-testid="sample-workspace">
      <aside className="rs-sample__banner" aria-labelledby="sample-banner-label" data-testid="sample-banner">
        <p className="rs-sample__text">
          <span id="sample-banner-label" className="rs-sample__label">Beispiel</span>
          Erfundenes Unternehmen, erfundene Zahlen. So sieht das Dashboard aus, wenn Website, Scan,
          KI-Systeme und Aktivierung eingerichtet sind. Aus Ihrem Workspace wird nichts gelesen
          oder geändert; Links führen in Ihre eigenen Bereiche.
        </p>
        <Link to="/app/dashboard" className="rs-sample__back" data-testid="sample-back">
          Zurück zu Ihrem Workspace
        </Link>
      </aside>
      <CustomerStartPanel
        tenantName={SAMPLE_TENANT_NAME}
        facts={facts}
        model={model}
        lastScanRunAt={data.signals?.lastScanAt ?? null}
        trial={null}
        data={data}
      />
      <ComplianceStatusView
        sample
        tenantName={SAMPLE_TENANT_NAME}
        activeTenantId={SAMPLE_VIEW_ID}
        data={data}
        complianceKpi={complianceKpi}
        loading={false}
        error={null}
      />
    </div>
  );
}
