// CeoBriefPrintView — druckoptimierte Prüfer-Mappe (Route /app/cockpit/brief).
//
// Eigenständige, helle A4-Ansicht (ausserhalb der Governance-Shell), die
// dieselben Cockpit-Daten verdichtet, einen SHA-256-Integritäts-Hash als
// Übergabe-Anker ausweist und den Druckdialog (Als PDF speichern) auslöst.
import { useEffect, useState } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { loadCockpitData, cockpitIntegrityHash, type CockpitData } from './cockpitData';
import { scoreLabel } from './cockpitScore';

const PRINT_CSS = `
  @page { size: A4; margin: 20mm; }
  .brief { font-family: Inter, Arial, sans-serif; color: #0A0A0B; background: #fff; max-width: 820px; margin: 0 auto; padding: 32px; }
  .brief h1 { font-size: 22px; margin: 0 0 4px; }
  .brief h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .brief .muted { color: #555; font-size: 12px; }
  .brief .mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
  .brief table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  .brief th, .brief td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  .brief .kpi { display: flex; gap: 24px; margin-top: 8px; }
  .brief .kpi div { border: 1px solid #ddd; padding: 12px 16px; }
  .brief .kpi b { font-size: 28px; display: block; }
  .brief .hashbox { margin-top: 16px; border: 1px solid #ddd; padding: 10px; background: #fafafa; word-break: break-all; }
  .no-print { margin: 16px auto; max-width: 820px; }
  @media print { .no-print { display: none !important; } }
`;

export function CeoBriefPrintView() {
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? '—';
  const [data, setData] = useState<CockpitData | null>(null);
  const [hash, setHash] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const generated = new Date();
  const generatedDate = generated.toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) return;
    loadCockpitData(activeTenantId)
      .then(async (d) => {
        if (cancelled) return;
        setData(d);
        setHash(await cockpitIntegrityHash(d, generatedDate));
        // Druckdialog erst nach Render + Hash auslösen.
        setTimeout(() => { if (!cancelled) window.print(); }, 400);
      })
      .catch((e) => { if (!cancelled) setError((e as Error)?.message ?? String(e)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  if (!activeTenantId) {
    return <div style={{ padding: 40 }}>Bitte anmelden, um die Prüfer-Mappe zu erzeugen.</div>;
  }
  if (error) {
    return <div style={{ padding: 40, color: '#b00' }}>Fehler: {error}</div>;
  }
  if (!data) {
    return <div style={{ padding: 40 }}>Prüfer-Mappe wird erzeugt …</div>;
  }

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <style>{PRINT_CSS}</style>

      <div className="no-print" style={{ textAlign: 'right' }}>
        <button onClick={() => window.print()} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Drucken / als PDF speichern
        </button>
      </div>

      <div className="brief">
        <h1>Governance-Prüfer-Mappe</h1>
        <p className="muted">
          {tenantName} · erstellt am {generated.toLocaleDateString('de-DE')}
          {data.lastUpdated ? ` · KPI-Stand ${data.lastUpdated}` : ''}
        </p>

        <h2>Gesamtbewertung</h2>
        <div className="kpi">
          <div>
            <b>{data.score}/100</b>
            <span className="muted">Governance-Score · {scoreLabel(data.score)}</span>
          </div>
          <div>
            <b>{data.readiness === null ? '–' : `${data.readiness}%`}</b>
            <span className="muted">Audit-Readiness (indikativ)</span>
          </div>
        </div>

        <h2>Offene Posten</h2>
        <table>
          <tbody>
            <tr><td>Offene Vorfälle</td><td>{data.counts.incidents}</td></tr>
            <tr><td>Betroffenenanfragen überfällig</td><td>{data.counts.dsr.overdue}</td></tr>
            <tr><td>Offene DSFA</td><td>{data.counts.dpias}</td></tr>
            <tr><td>Vendoren ohne AVV</td><td>{data.counts.vendorsNoDpa}</td></tr>
            <tr><td>Ausstehende Freigaben</td><td>{data.counts.approvals}</td></tr>
          </tbody>
        </table>

        <h2>Dringendste Pflichten</h2>
        {data.actions.length === 0 ? (
          <p className="muted">Keine dringenden Pflichten offen.</p>
        ) : (
          <table>
            <thead><tr><th>#</th><th>Maßnahme</th><th>Schweregrad</th><th>Frist</th></tr></thead>
            <tbody>
              {data.actions.map((a, i) => (
                <tr key={a.id}>
                  <td>{i + 1}</td>
                  <td>{a.title}</td>
                  <td>{a.level}</td>
                  <td>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data.posture && (
          <>
            <h2>Abdeckung</h2>
            <table>
              <tbody>
                <tr><td>Richtlinien aktiv</td><td>{Math.round(data.posture.policiesEnabledPercent)}%</td></tr>
                <tr><td>Evidence-Abdeckung</td><td>{Math.round(data.posture.assetEvidencePercent)}%</td></tr>
                <tr><td>Kontroll-Mapping</td><td>{Math.round(data.posture.assetMappingsPercent)}%</td></tr>
              </tbody>
            </table>
          </>
        )}

        <div className="hashbox mono">
          <strong>Integritäts-Anker (SHA-256):</strong><br />{hash}
          <br /><span className="muted">Deterministisch über den Datenstand — Prüfer kann den Hash zur Verifikation ins Übergabe-Protokoll aufnehmen.</span>
        </div>
      </div>
    </div>
  );
}
