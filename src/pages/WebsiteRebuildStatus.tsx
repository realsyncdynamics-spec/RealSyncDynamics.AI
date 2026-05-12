import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { RebuildBeforeAfter, metricsFromSteps } from '../components/RebuildBeforeAfter';

const supabase = getSupabase();

// ─── Types ────────────────────────────────────────────────────────────────────

type RebuildStatus =
    | 'queued'
  | 'running'
  | 'preview_ready'
  | 'live'
  | 'failed'
  | 'cancelled';

type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

interface RebuildStep {
    id: string;
    step_name: string;
    status: StepStatus;
    started_at: string | null;
    completed_at: string | null;
    duration_ms: number | null;
    summary: string | null;
    error_detail: string | null;
    metadata: Record<string, unknown> | null;
}

interface WebsiteRebuild {
    id: string;
    source_url: string;
    source_domain: string;
    customer_email: string;
    company: string | null;
    tier: 'managed' | 'premium' | 'enterprise';
    status: RebuildStatus;
    current_step: string | null;
    completed_steps: string[];
    preview_url: string | null;
    error_code: string | null;
    error_detail: string | null;
    workflow_version: string;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

// ─── Step-Metadata ────────────────────────────────────────────────────────────

const PIPELINE_STEPS: Array<{ key: string; label: string; description: string; icon: string }> = [
  { key: 'scrape',         label: 'Website scannen',          description: 'HTML, CSS, Scripts und Assets werden geladen',         icon: '🔍' },
  { key: 'audit',          label: 'DSGVO-Analyse',            description: 'Tracker, Cookies und Rechtsverstöße werden erkannt',  icon: '⚖️' },
  { key: 'strip_trackers', label: 'Tracker entfernen',        description: 'GA, Meta-Pixel, TikTok & Co. werden deaktiviert',     icon: '🧹' },
  { key: 'self_host',      label: 'Fonts lokalisieren',       description: 'Google Fonts werden lokal gehostet (kein US-Transfer)', icon: '📦' },
  { key: 'inject_consent', label: 'Consent-Banner einbauen',  description: 'DSGVO-konformes Cookie-Opt-In wird integriert',       icon: '✅' },
  { key: 'legal_pages',    label: 'Rechtsdokumente erstellen', description: 'Datenschutzerklärung, Impressum und AVV werden generiert', icon: '📄' },
  { key: 'ai_ready',       label: 'KI-Readiness',             description: 'llms.txt, JSON-LD und ai-info.json werden eingefügt', icon: '🤖' },
  { key: 'package_deploy', label: 'Veröffentlichen',          description: 'Website wird gebündelt und Preview-URL erzeugt',      icon: '🚀' },
  ];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('de-DE', {
          dateStyle: 'short',
          timeStyle: 'medium',
    }).format(new Date(iso));
}

function getStepStatus(stepKey: string, steps: RebuildStep[], completedSteps: string[], currentStep: string | null): StepStatus {
    const row = steps.find((s) => s.step_name === stepKey);
    if (row) return row.status;
    if (completedSteps.includes(stepKey)) return 'success';
    if (currentStep === stepKey) return 'running';
    return 'pending';
}

function StatusBadge({ status }: { status: RebuildStatus }) {
    const map: Record<RebuildStatus, { label: string; color: string }> = {
          queued:        { label: 'In Warteschlange', color: '#6B7280' },
          running:       { label: 'Läuft…',           color: '#F59E0B' },
          preview_ready: { label: 'Preview bereit',   color: '#10B981' },
          live:          { label: 'Live',             color: '#059669' },
          failed:        { label: 'Fehler',           color: '#EF4444' },
          cancelled:     { label: 'Abgebrochen',      color: '#6B7280' },
    };
    const { label, color } = map[status] ?? { label: status, color: '#6B7280' };
    return (
          <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: color + '22',
                  border: `1px solid ${color}55`,
                  color,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
          }}>
            {status === 'running' && <span style={{ animation: 'pulse 1.5s infinite' }}>●</span>}
            {label}
          </span>
        );
}

function StepRow({ meta, stepData, completedSteps, currentStep }: {
    meta: typeof PIPELINE_STEPS[0];
    stepData: RebuildStep[];
    completedSteps: string[];
    currentStep: string | null;
}) {
    const status = getStepStatus(meta.key, stepData, completedSteps, currentStep);
    const row = stepData.find((s) => s.step_name === meta.key);

  const statusConfig: Record<StepStatus, { icon: string; color: string; bg: string }> = {
        pending: { icon: '○',  color: '#6B7280', bg: '#6B728011' },
        running: { icon: '◌',  color: '#F59E0B', bg: '#F59E0B11' },
        success: { icon: '✓',  color: '#10B981', bg: '#10B98111' },
        failed:  { icon: '✗',  color: '#EF4444', bg: '#EF444411' },
        skipped: { icon: '–',  color: '#6B7280', bg: '#6B728011' },
  };
    const cfg = statusConfig[status];

  return (
        <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                padding: '16px',
                borderRadius: '8px',
                background: cfg.bg,
                border: `1px solid ${cfg.color}33`,
                transition: 'all 0.3s ease',
        }}>
          {/* Step status indicator */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: cfg.color + '22',
                  border: `2px solid ${cfg.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: cfg.color,
                  fontWeight: 700,
                  fontSize: '1rem',
                  flexShrink: 0,
                  animation: status === 'running' ? 'pulse 1.5s infinite' : 'none',
        }}>
                  {cfg.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '0.9rem' }}>{meta.icon}</span>
                                      <strong style={{ color: '#E2E2E2', fontSize: '0.95rem' }}>{meta.label}</strong>
                            {row?.duration_ms && (
                      <span style={{ color: '#6B7280', fontSize: '0.75rem' }}>
                        {formatDuration(row.duration_ms)}
                      </span>
                    )}
                          </div>
                          <p style={{ margin: '4px 0 0', color: '#9CA3AF', fontSize: '0.82rem' }}>
                            {meta.description}
                          </p>
                  {row?.summary && (
                    <p style={{ margin: '6px 0 0', color: '#D1D5DB', fontSize: '0.82rem', fontStyle: 'italic' }}>
                      {row.summary}
                    </p>
                  )}
                  {row?.error_detail && (
                    <pre style={{
                                  margin: '6px 0 0',
                                  padding: '8px',
                                  background: '#EF444411',
                                  border: '1px solid #EF444433',
                                  borderRadius: '4px',
                                  color: '#FCA5A5',
                                  fontSize: '0.75rem',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                    }}>
                      {row.error_detail}
                    </pre>
                  )}
                </div>
        </div>
      );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WebsiteRebuildStatus() {
    const { rebuild_id } = useParams<{ rebuild_id: string }>();
    const [rebuild, setRebuild] = useState<WebsiteRebuild | null>(null);
    const [steps, setSteps] = useState<RebuildStep[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState(0);

  // ── Initial load ──
  useEffect(() => {
        if (!rebuild_id) return;

                async function load() {
                        setLoading(true);
                        setError(null);

          const { data: rebuildData, error: rebuildErr } = await supabase
                          .from('website_rebuilds')
                          .select('*')
                          .eq('id', rebuild_id)
                          .single();

          if (rebuildErr || !rebuildData) {
                    setError('Rebuild-Job nicht gefunden. Bitte prüfe den Link oder kontaktiere support@realsyncdynamicsai.de.');
                    setLoading(false);
                    return;
          }

          setRebuild(rebuildData as WebsiteRebuild);

          const { data: stepData } = await supabase
                          .from('website_rebuild_steps')
                          .select('*')
                          .eq('rebuild_id', rebuild_id)
                          .order('created_at', { ascending: true });

                                    setSteps((stepData ?? []) as RebuildStep[]);
                        setLoading(false);
                }

                load();
  }, [rebuild_id]);

  // ── Realtime subscription ──
  useEffect(() => {
        if (!rebuild_id) return;

                const rebuildChannel = supabase
          .channel(`rebuild:${rebuild_id}`)
          .on(
                    'postgres_changes',
            {
                        event: '*',
                        schema: 'public',
                        table: 'website_rebuilds',
                        filter: `id=eq.${rebuild_id}`,
            },
                    (payload) => {
                                if (payload.new) setRebuild(payload.new as WebsiteRebuild);
                    }
                  )
          .on(
                    'postgres_changes',
            {
                        event: '*',
                        schema: 'public',
                        table: 'website_rebuild_steps',
                        filter: `rebuild_id=eq.${rebuild_id}`,
            },
                    (payload) => {
                                if (payload.new) {
                                              const newStep = payload.new as RebuildStep;
                                              setSteps((prev) => {
                                                              const idx = prev.findIndex((s) => s.id === newStep.id);
                                                              if (idx >= 0) {
                                                                                const updated = [...prev];
                                                                                updated[idx] = newStep;
                                                                                return updated;
                                                              }
                                                              return [...prev, newStep];
                                              });
                                }
                    }
                  )
          .subscribe();

                return () => {
                        supabase.removeChannel(rebuildChannel);
                };
  }, [rebuild_id]);

  // ── Elapsed time counter (only while running) ──
  useEffect(() => {
        if (!rebuild || rebuild.status !== 'running') return;
        const start = rebuild.started_at ? new Date(rebuild.started_at).getTime() : Date.now();
        const interval = setInterval(() => {
                setElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);
        return () => clearInterval(interval);
  }, [rebuild?.status, rebuild?.started_at]);

  // ── Overall progress ──
  const completedCount = rebuild
      ? PIPELINE_STEPS.filter((s) =>
                (rebuild.completed_steps ?? []).includes(s.key) ||
                steps.find((r) => r.step_name === s.key && r.status === 'success')
                                    ).length
        : 0;
    const progressPct = Math.round((completedCount / PIPELINE_STEPS.length) * 100);

  // ── Render ──
  if (loading) {
        return (
                <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E2E2E2', fontFamily: 'monospace' }}>
                          <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: '2rem', marginBottom: '16px', animation: 'spin 2s linear infinite', display: 'inline-block' }}>⟳</div>
                                      <p>Lade Rebuild-Status…</p>
                          </div>
                </div>
              );
  }
  
    if (error || !rebuild) {
          return (
                  <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                          <div style={{ maxWidth: '480px', textAlign: 'center', color: '#E2E2E2' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
                                    <h2 style={{ marginBottom: '12px' }}>Rebuild nicht gefunden</h2>
                                    <p style={{ color: '#9CA3AF', marginBottom: '24px' }}>{error}</p>
                                    <Link to="/dsgvo-website" style={{ color: '#FFB800', textDecoration: 'none', border: '1px solid #FFB800', padding: '10px 24px', borderRadius: '6px' }}>
                                ← Zurück zur Übersicht
                                    </Link>
                          </div>
                  </div>
                );
    }
  
    return (
          <div style={{ minHeight: '100vh', background: '#0A0A0F', color: '#E2E2E2', fontFamily: "'Courier New', monospace" }}>
          
            {/* ── Header ── */}
                <div style={{ borderBottom: '1px solid #1E1E28', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <Link to="/dsgvo-website" style={{ color: '#9CA3AF', textDecoration: 'none', fontSize: '0.85rem' }}>← DSGVO-Website</Link>
                                  <span style={{ color: '#374151' }}>|</span>
                                  <span style={{ fontSize: '0.85rem', color: '#6B7280', letterSpacing: '0.08em' }}>REBUILD-STATUS</span>
                        </div>
                        <StatusBadge status={rebuild.status} />
                </div>
          
                <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px' }}>
                
                  {/* ── Domain + Meta ── */}
                        <div style={{ marginBottom: '32px' }}>
                                  <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '8px', color: '#F9FAFB' }}>
                                    {rebuild.source_domain}
                                  </h1>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', color: '#9CA3AF', fontSize: '0.82rem' }}>
                                              <span>Tier: <strong style={{ color: '#E2E2E2', textTransform: 'capitalize' }}>{rebuild.tier}</strong></span>
                                              <span>Gestartet: <strong style={{ color: '#E2E2E2' }}>{formatDate(rebuild.started_at ?? rebuild.created_at)}</strong></span>
                                    {rebuild.status === 'running' && (
                          <span>Laufzeit: <strong style={{ color: '#F59E0B' }}>{elapsed}s</strong></span>
                                              )}
                                    {rebuild.completed_at && (
                          <span>Abgeschlossen: <strong style={{ color: '#E2E2E2' }}>{formatDate(rebuild.completed_at)}</strong></span>
                                              )}
                                              <span>Engine: <strong style={{ color: '#E2E2E2' }}>{rebuild.workflow_version}</strong></span>
                                  </div>
                        </div>
                
                  {/* ── Progress Bar ── */}
                  {rebuild.status !== 'failed' && rebuild.status !== 'cancelled' && (
                      <div style={{ marginBottom: '32px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem', color: '#9CA3AF' }}>
                                                <span>Fortschritt</span>
                                                <span style={{ color: progressPct === 100 ? '#10B981' : '#E2E2E2', fontWeight: 600 }}>{progressPct}%</span>
                                  </div>
                                  <div style={{ height: '6px', background: '#1E1E28', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{
                                        height: '100%',
                                        width: `${progressPct}%`,
                                        background: progressPct === 100 ? '#10B981' : 'linear-gradient(90deg, #FFB800, #FF8C00)',
                                        borderRadius: '3px',
                                        transition: 'width 0.6s ease',
                      }} />
                                  </div>
                                  <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#6B7280' }}>
                                    {completedCount} von {PIPELINE_STEPS.length} Schritten abgeschlossen
                                  </div>
                      </div>
                        )}
                
                  {/* ── Preview-URL CTA ── */}
                  {(rebuild.status === 'preview_ready' || rebuild.status === 'live') && rebuild.preview_url && (
                      <div style={{
                                    marginBottom: '32px',
                                    padding: '20px 24px',
                                    background: '#10B98111',
                                    border: '1px solid #10B98155',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '16px',
                      }}>
                                  <div>
                                                <div style={{ color: '#10B981', fontWeight: 700, marginBottom: '4px', fontSize: '0.9rem' }}>
                                                                ✓ DSGVO-konforme Version bereit
                                                </div>
                                                <div style={{ color: '#9CA3AF', fontSize: '0.82rem' }}>
                                                                Deine neue Website ist verfügbar — prüfe sie, bevor sie live geht.
                                                </div>
                                  </div>
                                  <a
                                                  href={rebuild.preview_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px',
                                                                    padding: '10px 20px',
                                                                    background: '#10B981',
                                                                    color: '#000',
                                                                    borderRadius: '6px',
                                                                    textDecoration: 'none',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.9rem',
                                                                    whiteSpace: 'nowrap',
                                                  }}
                                                >
                                                Preview öffnen →
                                  </a>
                      </div>
                        )}
                
                  {/* ── Error Banner ── */}
                  {rebuild.status === 'failed' && (
                      <div style={{
                                    marginBottom: '32px',
                                    padding: '20px 24px',
                                    background: '#EF444411',
                                    border: '1px solid #EF444455',
                                    borderRadius: '10px',
                      }}>
                                  <div style={{ color: '#EF4444', fontWeight: 700, marginBottom: '8px' }}>
                                                ✗ Fehler im Rebuild-Prozess
                                  </div>
                        {rebuild.error_code && (
                                      <div style={{ color: '#FCA5A5', fontSize: '0.82rem', marginBottom: '4px' }}>
                                                      Code: <code style={{ background: '#EF444422', padding: '2px 6px', borderRadius: '3px' }}>{rebuild.error_code}</code>
                                      </div>
                                  )}
                        {rebuild.error_detail && (
                                      <pre style={{ color: '#FCA5A5', fontSize: '0.78rem', whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>
                                        {rebuild.error_detail}
                                      </pre>
                                  )}
                                  <p style={{ color: '#9CA3AF', fontSize: '0.82rem', marginTop: '12px', marginBottom: 0 }}>
                                                Unser Team wurde automatisch benachrichtigt. Kontaktiere{' '}
                                                <a href="mailto:support@realsyncdynamicsai.de" style={{ color: '#FFB800' }}>
                                                                support@realsyncdynamicsai.de
                                                </a>{' '}
                                                mit deiner Rebuild-ID: <code style={{ color: '#E2E2E2' }}>{rebuild.id}</code>
                                  </p>
                      </div>
                        )}
                
                  {/* ── Pipeline Steps ── */}
                        <div style={{ marginBottom: '32px' }}>
                                  <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>
                                              Pipeline-Status
                                  </h2>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {PIPELINE_STEPS.map((meta) => (
                          <StepRow
                                            key={meta.key}
                                            meta={meta}
                                            stepData={steps}
                                            completedSteps={rebuild.completed_steps ?? []}
                                            currentStep={rebuild.current_step}
                                          />
                        ))}
                                  </div>
                        </div>

                  {/* ── Vorher / Nachher (nur wenn Rebuild abgeschlossen) ── */}
                  {(rebuild.status === 'preview_ready' || rebuild.status === 'live') && steps.length > 0 && (
                    <div style={{ marginTop: '24px' }}>
                      <RebuildBeforeAfter
                        metrics={metricsFromSteps(steps)}
                        sourceDomain={rebuild.source_domain}
                        previewUrl={rebuild.preview_url}
                      />
                    </div>
                  )}
                
                  {/* ── Rebuild-Info Footer ── */}
                        <div style={{
                      padding: '16px',
                      background: '#0D0D15',
                      border: '1px solid #1E1E28',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      color: '#6B7280',
          }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                                              <span>Rebuild-ID: <code style={{ color: '#9CA3AF' }}>{rebuild.id}</code></span>
                                              <span>URL: <code style={{ color: '#9CA3AF' }}>{rebuild.source_url}</code></span>
                                    {rebuild.company && <span>Firma: <code style={{ color: '#9CA3AF' }}>{rebuild.company}</code></span>}
                                  </div>
                                  <div style={{ marginTop: '8px' }}>
                                              Diese Seite aktualisiert sich automatisch in Echtzeit via Supabase Realtime.
                                              Kein Reload nötig.
                                  </div>
                        </div>
                
                </div>
          
                <style>{`
                        @keyframes pulse {
                                  0%, 100% { opacity: 1; }
                                            50% { opacity: 0.4; }
                                                    }
                                                            @keyframes spin {
                                                                      from { transform: rotate(0deg); }
                                                                                to { transform: rotate(360deg); }
                                                                                        }
                                                                                              `}</style>
          </div>
        );
}
