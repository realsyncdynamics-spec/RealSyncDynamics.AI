/**
 * Kein Ergebnis darf gewürfelt sein.
 *
 * ## Warum das ein eigener Test ist
 *
 * Eine Governance-Oberfläche, die eine Zahl zeigt, behauptet damit eine
 * Messung. Am 2026-09-14 stimmte das an vier Stellen nicht:
 *
 *   - Das Monitoring-Dashboard errechnete „Ø Zeit bis Lösung" aus
 *     `Math.random()` je gelöstem Alert — echte Alert-Zeilen, erfundene
 *     Kennzahl, bei jedem Reload eine andere.
 *   - Der Analytics-Export ließ einen Fortschrittsbalken per `Math.random()`
 *     auf 90 % laufen, während der Server gar keinen Fortschritt meldet.
 *   - Der Massen-Import zeigte jedem Mandanten dieselbe im Quelltext
 *     festgeschriebene Import-Historie und würfelte die Zeilenzahl neuer Jobs.
 *   - `/app/governance/integrations` war eine zweite Webhook-Oberfläche, die
 *     Endpoints nur im React-State hielt und „Test payload sent!" meldete,
 *     ohne je zu senden.
 *
 * Solche Stellen kommen nicht durch Bosheit zurück, sondern beim schnellen
 * Ausfüllen einer leeren Ansicht. Deshalb steht hier ein Test und kein
 * Kommentar.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

const MONITORING = read('src/features/governance/ComplianceMonitoringDashboard.tsx');
const EXPORT_MODAL = read('src/features/governance/analytics/ExportModal.tsx');
const BULK = read('src/features/governance/BulkOperationsView.tsx');
const APP = read('src/App.tsx');

/** Kommentare ausblenden — dort steht die Historie, warum es den Test gibt. */
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('Monitoring-Kennzahlen', () => {
  it('würfelt keine Kennzahl', () => {
    expect(withoutComments(MONITORING)).not.toContain('Math.random(');
  });

  it('rechnet die Lösungsdauer aus echten Zeitstempeln', () => {
    expect(MONITORING).toContain("'id, severity, status, created_at, resolved_at'");
    expect(MONITORING).toContain('new Date(a.resolved_at as string).getTime() - new Date(a.created_at).getTime()');
  });

  it('zeigt ohne gelöste Alerts keine Zahl statt einer erfundenen', () => {
    expect(MONITORING).toContain("metrics.avg_time_to_resolve === null ? '—'");
  });

  it('behauptet keinen Monitoring-Lauf, den niemand gemessen hat', () => {
    expect(MONITORING).not.toContain('last_monitoring_run');
  });
});

describe('Analytics-Export', () => {
  it('simuliert keinen Fortschritt', () => {
    const code = withoutComments(EXPORT_MODAL);
    expect(code).not.toContain('Math.random(');
    expect(code).not.toContain('setProgress(');
  });

  it('exportiert weiterhin echt', () => {
    expect(EXPORT_MODAL).toContain('await exportKpiData(request)');
  });
});

describe('Massen-Import', () => {
  it('zeigt keine erfundene Job-Historie', () => {
    const code = withoutComments(BULK);
    expect(code).not.toContain('q2-vulnerability-scan.csv');
    expect(code).not.toContain('iso27001-evidence-batch.zip');
    expect(code).not.toContain('Math.random(');
  });

  it('sagt ausdrücklich, dass die Funktion fehlt', () => {
    expect(BULK).toContain('Noch nicht verfügbar');
  });

  it('verweist auf die echte Bulk-Runtime', () => {
    expect(BULK).toContain('to="/app/bulk"');
    expect(APP).toContain('path="/app/bulk"');
  });
});

describe('Webhooks', () => {
  it('hat nur noch eine Oberfläche', () => {
    expect(APP).toContain(
      '<Route path="/app/governance/integrations" element={<Navigate to="/app/webhooks" replace />} />',
    );
    expect(APP).not.toContain('<IntegrationsView />');
    expect(APP).toContain('path="/app/webhooks"');
  });
});
