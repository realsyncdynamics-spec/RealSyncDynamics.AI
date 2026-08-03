'use client';

import { useEffect, useState } from 'react';

const GOVERNANCE_URL = process.env.NEXT_PUBLIC_GOVERNANCE_URL ?? 'http://rsd.localhost';

type ProjectRecord = {
  project_id: string;
  project_name: string;
  risk_tier: 'minimal' | 'limited' | 'high' | 'unacceptable';
  required_gates: string[];
  status: string;
  last_gate_status: string | null;
};

const TIER_COLOR: Record<ProjectRecord['risk_tier'], string> = {
  minimal: '#0F766E',
  limited: '#B45309',
  high: '#B91C1C',
  unacceptable: '#000000',
};

/**
 * Governance-Cockpit-Stub: Projektliste mit Risk-Tier-Anzeige.
 *
 * TODO: Filter nach Tier/Status, Gate-Historie je Projekt, Drift-Alarme.
 */
export default function GovernancePage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${GOVERNANCE_URL}/api/v1/governance/projects`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => setProjects(data.projects ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 960 }}>
      <h1>Governance-Cockpit</h1>
      <p>Registrierte KI-Projekte mit Risikoklasse und letztem Gate-Ergebnis.</p>

      {error && <p style={{ color: '#b00020' }}>Fehler: {error}</p>}

      {projects.length === 0 && !error && <p>Noch keine Projekte registriert.</p>}

      {projects.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: 8 }}>Projekt</th>
              <th style={{ padding: 8 }}>Risikoklasse</th>
              <th style={{ padding: 8 }}>Gates</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Letztes Gate</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.project_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: 8 }}>
                  {project.project_name}
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                    {project.project_id}
                  </div>
                </td>
                <td style={{ padding: 8, color: TIER_COLOR[project.risk_tier], fontWeight: 600 }}>
                  {project.risk_tier}
                </td>
                <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 12 }}>
                  {project.required_gates.join(', ') || '—'}
                </td>
                <td style={{ padding: 8 }}>{project.status}</td>
                <td style={{ padding: 8 }}>{project.last_gate_status ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
