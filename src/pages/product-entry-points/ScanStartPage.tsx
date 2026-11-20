import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { V3ModuleSwitch, V3PageShell } from '../../components/landing/v3/V3Shell';

/**
 * Product entry `/scan/start` — wires to the canonical public scan at `/audit`.
 * No fake-success alert; the live funnel is AuditLanding.
 * Gestaltung und Navigation wie die Startseite v3 (`V3PageShell`).
 */
export function ScanStartPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');

  function startScan(e?: FormEvent) {
    e?.preventDefault();
    const value = url.trim();
    navigate(value ? `/audit?domain=${encodeURIComponent(value)}` : '/audit');
  }

  return (
    <V3PageShell
      current="/scan/start"
      source="scan_start"
      crumbs={[{ label: 'Start', to: '/' }, { label: 'Website-Scan' }]}
    >
      <SEOHead />
      <section className="lv3-section lv3-section--first lv3-start" aria-labelledby="scan-h1">
        <span className="lv3-eyebrow">Kostenloser Check · kein Account nötig</span>
        <h1 id="scan-h1" className="lv3-page-h1">Website Compliance Scan</h1>
        <p className="lv3-text">
          Geben Sie eine Website-URL ein und wir prüfen diese automatisiert auf DSGVO-, EU AI Act- und Code-Compliance. Erhalten Sie einen detaillierten Bericht in Echtzeit — komplett kostenlos.
        </p>
        <form className="lv3-form" onSubmit={startScan} noValidate>
          <label className="lv3-label" htmlFor="scan-start-url">
            Website-URL eingeben
            <input
              id="scan-start-url"
              className="lv3-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </label>
          <button type="submit" className="lv3-btn lv3-btn--solid lv3-btn--lg">Governance Scan starten</button>
        </form>
        <p className="lv3-fine">Weiterleitung auf /audit · kein Account nötig</p>
      </section>

      <V3ModuleSwitch />
    </V3PageShell>
  );
}
