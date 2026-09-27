import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Lock, Loader2, Plus, Sparkles } from 'lucide-react';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { useTenant } from '../../../core/access/TenantProvider';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { getSupabase } from '../../../lib/supabase';
import { Button } from '../../../enterprise-os/components/Button';
import { Card, CardBody, CardHeader } from '../../../enterprise-os/components/Card';
import {
  appendFmtGovernanceEvent,
  createFmtProject,
  getFmtProject,
  listFmtProjects,
  listFmtSourceSites,
  setFmtWizardStep,
  upsertFmtSourceSite,
} from './fmtApi';
import {
  FMT_ENTITLEMENT_KEY,
  FMT_STEPS,
  type FmtProject,
  type FmtSourceSite,
  type FmtWizardStep,
} from './fmtTypes';

/**
 * /app/siteos/modernize — Frontend Modernization Wizard (Enterprise+).
 * Greenfield bleibt /build und /app/siteos/builder. Landing H1/CTAs unberührt.
 */
export function FmtModernizeWizard() {
  return <AuthGate>{() => <FmtModernizeInner />}</AuthGate>;
}

function FmtModernizeInner() {
  const { activeTenantId } = useTenant();
  const { hasFeature, loading: entLoading, canAccess } = useEntitlements();
  const entitled = hasFeature(FMT_ENTITLEMENT_KEY);
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();
  const [search] = useSearchParams();

  const [projects, setProjects] = useState<FmtProject[]>([]);
  const [project, setProject] = useState<FmtProject | null>(null);
  const [sources, setSources] = useState<FmtSourceSite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const reloadList = useCallback(async () => {
    if (!activeTenantId) return;
    const rows = await listFmtProjects(activeTenantId);
    setProjects(rows);
  }, [activeTenantId]);

  const reloadProject = useCallback(async (id: string) => {
    const p = await getFmtProject(id);
    setProject(p);
    if (p) {
      const sites = await listFmtSourceSites(p.id);
      setSources(sites);
      if (sites[0]?.source_url) setSourceUrl(sites[0].source_url);
    }
  }, []);

  useEffect(() => {
    if (!activeTenantId || !entitled) return;
    void (async () => {
      try {
        setError(null);
        await reloadList();
        if (projectId) await reloadProject(projectId);
        else setProject(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
      }
    })();
  }, [activeTenantId, entitled, projectId, reloadList, reloadProject]);

  // Deep-link ?new=1 opens create form focus
  useEffect(() => {
    if (search.get('new') === '1') setNewName('Modernisierungsprojekt');
  }, [search]);

  if (entLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-obsidian-900 text-titanium-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (!entitled) {
    const access = canAccess(FMT_ENTITLEMENT_KEY);
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-obsidian-950 px-6 py-16 text-center">
        <div className="mb-5 grid h-12 w-12 place-items-center border border-[#e4cfa2]/40 bg-[#e4cfa2]/10 text-[#e4cfa2]">
          <Lock size={20} aria-hidden />
        </div>
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[#e4cfa2]">
          Enterprise+ · frontend.modernization
        </p>
        <h1 className="font-display max-w-lg text-2xl font-semibold text-titanium-50">
          Frontend Modernization ist in Ihrem Plan nicht enthalten
        </h1>
        <p className="mt-3 max-w-md text-sm text-titanium-400">
          Wizard und persistierte Modernisierungsprojekte (`fmt_*`) sind für Enterprise und Partner
          freigeschaltet. Greenfield-Sites bleiben unter /build und SiteOS Builder erreichbar.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/app/siteos"
            className="border border-titanium-700 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-titanium-300"
          >
            Zurück zu SiteOS
          </Link>
          {access.upgradeUrl && (
            <a
              href={access.upgradeUrl}
              className="border border-[#e4cfa2]/50 bg-[#e4cfa2]/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-[#e4cfa2]"
            >
              Upgrade / Anfrage
            </a>
          )}
          <Link
            to="/contact-sales?plan=enterprise&topic=frontend-modernization"
            className="border border-[#e4cfa2]/50 bg-[#e4cfa2] px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-black"
          >
            Enterprise anfragen
          </Link>
        </div>
      </div>
    );
  }

  const onCreate = async () => {
    if (!activeTenantId) return;
    setBusy(true);
    setError(null);
    try {
      const { data: userData } = await getSupabase().auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Nicht angemeldet');
      const created = await createFmtProject({
        tenantId: activeTenantId,
        userId,
        name: newName || 'Modernisierungsprojekt',
      });
      await appendFmtGovernanceEvent({
        tenantId: activeTenantId,
        projectId: created.id,
        eventType: 'project_created',
        payload: { name: created.name },
      });
      navigate(`/app/siteos/modernize/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const onSaveSource = async () => {
    if (!activeTenantId || !project || !sourceUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await upsertFmtSourceSite({
        tenantId: activeTenantId,
        projectId: project.id,
        sourceUrl: sourceUrl.trim(),
      });
      const next = await setFmtWizardStep(project.id, 2, 'in_progress');
      await appendFmtGovernanceEvent({
        tenantId: activeTenantId,
        projectId: project.id,
        eventType: 'source_saved',
        payload: { source_url: sourceUrl.trim() },
      });
      setProject(next);
      await reloadProject(project.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quelle speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const onAdvance = async (to: FmtWizardStep) => {
    if (!activeTenantId || !project) return;
    setBusy(true);
    setError(null);
    try {
      const status = to === 6 ? 'ready_to_publish' : 'in_progress';
      const next = await setFmtWizardStep(project.id, to, status);
      await appendFmtGovernanceEvent({
        tenantId: activeTenantId,
        projectId: project.id,
        eventType: 'wizard_step',
        payload: { step: to },
      });
      setProject(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Schritt speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const onMarkReady = async () => {
    if (!activeTenantId || !project) return;
    setBusy(true);
    setError(null);
    try {
      const next = await setFmtWizardStep(project.id, 6, 'ready_to_publish');
      await appendFmtGovernanceEvent({
        tenantId: activeTenantId,
        projectId: project.id,
        eventType: 'ready_to_publish',
        payload: { human_in_the_loop: true },
      });
      setProject(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Freigabe-Status fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  // Project list
  if (!projectId) {
    return (
      <div className="min-h-screen bg-obsidian-900 text-titanium-200">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Link
            to="/app/siteos"
            className="mb-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-titanium-500 hover:text-titanium-300"
          >
            <ArrowLeft size={14} /> SiteOS
          </Link>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e4cfa2]">
            Frontend Modernization
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-titanium-50">
            Bestehende Website modernisieren
          </h1>
          <p className="mt-2 max-w-xl text-sm text-titanium-400">
            Scan → Brand Brain → Blueprint → Agenten → Release Governance. Kein Ersatz für Backend —
            kontrolliertes Frontend mit Human-in-the-Loop.
          </p>

          {error && (
            <div role="alert" className="mt-4 border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <Card className="mt-6">
            <CardHeader eyebrow="Neu" title="Projekt anlegen" subtitle="Persistiert in fmt_projects (Enterprise+)." />
            <CardBody>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Projektname"
                  className="flex-1 border border-[rgba(228,207,162,0.35)] bg-[#1a1d24] px-3 py-2 text-sm text-[#f3ead8] placeholder:text-[#9a917f] focus:border-[#e4cfa2] focus:outline-none"
                />
                <Button onClick={() => void onCreate()} disabled={busy}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span className="ml-2">Anlegen</span>
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card className="mt-6">
            <CardHeader eyebrow="Projekte" title={`${projects.length} Modernisierung(en)`} />
            <CardBody className="p-0">
              {projects.length === 0 ? (
                <p className="px-5 py-6 text-sm text-titanium-500">Noch kein Projekt.</p>
              ) : (
                <ul className="divide-y divide-titanium-800">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/app/siteos/modernize/${p.id}`}
                        className="flex items-center justify-between px-5 py-4 hover:bg-white/5"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#f3ead8]">{p.name || 'Ohne Namen'}</p>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                            Schritt {p.wizard_step}/6 · {p.status}
                          </p>
                        </div>
                        <Sparkles size={14} className="text-[#e4cfa2]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-obsidian-900 text-titanium-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  const step = project.wizard_step as FmtWizardStep;

  return (
    <div className="min-h-screen bg-obsidian-900 text-titanium-200">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          to="/app/siteos/modernize"
          className="mb-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-titanium-500 hover:text-titanium-300"
        >
          <ArrowLeft size={14} /> Alle Projekte
        </Link>

        <header className="mb-6">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e4cfa2]">
            Wizard · Schritt {step}/6
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-titanium-50">{project.name}</h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-titanium-500">{project.status}</p>
        </header>

        {/* Stepper */}
        <ol className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          {FMT_STEPS.map((s) => {
            const done = s.step < step;
            const active = s.step === step;
            return (
              <li
                key={s.step}
                className={[
                  'rounded-lg border px-2 py-2 text-center',
                  active
                    ? 'border-[#e4cfa2]/55 bg-[#e4cfa2]/10'
                    : done
                      ? 'border-[rgba(228,207,162,0.25)] bg-white/5'
                      : 'border-titanium-800 bg-obsidian-950',
                ].join(' ')}
              >
                <p className="font-mono text-[9px] uppercase tracking-wider text-[#e4cfa2]">
                  {done ? <Check size={10} className="inline" /> : s.step}
                </p>
                <p className="mt-0.5 text-[11px] text-[#e8ddc8]">{s.label}</p>
              </li>
            );
          })}
        </ol>

        {error && (
          <div role="alert" className="mb-4 border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {step === 1 && (
          <Card>
            <CardHeader
              eyebrow="1 · Reality Scan"
              title="Quell-Website"
              subtitle="URL der bestehenden Kundenseite — Backend bleibt unberührt."
            />
            <CardBody>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://kunde.example"
                className="mb-3 w-full border border-[rgba(228,207,162,0.35)] bg-[#1a1d24] px-3 py-2 text-sm text-[#f3ead8] placeholder:text-[#9a917f] focus:border-[#e4cfa2] focus:outline-none"
              />
              {sources.length > 0 && (
                <p className="mb-3 font-mono text-[10px] text-titanium-500">
                  Gespeichert: {sources.map((s) => s.source_url).join(', ')}
                </p>
              )}
              <Button onClick={() => void onSaveSource()} disabled={busy || !sourceUrl.trim()}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                <span className={busy ? 'ml-2' : ''}>Speichern & weiter</span>
              </Button>
            </CardBody>
          </Card>
        )}

        {step === 2 && (
          <StepPlaceholder
            title="2 · Analyse"
            body="Vollständiger Site-Scan (Inhalte, Design, Formulare, Tracking, Conversion-Lücken) folgt über Edge — hier Schritt markieren, sobald Scan-Pipeline angebunden ist."
            busy={busy}
            onNext={() => void onAdvance(3)}
            nextLabel="Weiter zu Brand Brain"
          />
        )}

        {step === 3 && (
          <StepPlaceholder
            title="3 · Brand Brain"
            body="Strukturiertes Markenprofil (CI, Angebote, Tonalität, Legal, CTAs) — Persistenz in fmt_content_blocks. Human review vor Blueprint."
            busy={busy}
            onNext={() => void onAdvance(4)}
            nextLabel="Weiter zu Blueprint"
          />
        )}

        {step === 4 && (
          <StepPlaceholder
            title="4 · Frontend Blueprint"
            body="Seitenstruktur, Komponenten, CTA-Logik, SEO — fmt_frontend_blueprints (nicht SiteOS-Puck). Versionierung Pflicht."
            busy={busy}
            onNext={() => void onAdvance(5)}
            nextLabel="Weiter zu Agent Setup"
          />
        )}

        {step === 5 && (
          <StepPlaceholder
            title="5 · Agent Setup"
            body="Lead-/Support-/Buchungsbot und CRM-Übergabe — nur geprüfte RealSync-Module. Externe Skills/MCP nicht blind."
            busy={busy}
            onNext={() => void onAdvance(6)}
            nextLabel="Weiter zu Release"
          />
        )}

        {step === 6 && (
          <Card>
            <CardHeader
              eyebrow="6 · Release Governance"
              title="Freigabe (Human-in-the-Loop)"
              subtitle="Kein Auto-Publish. Preview, Changelog, Rollback und Audit-Log sind Pflicht vor Live."
            />
            <CardBody>
              <p className="mb-4 text-sm text-titanium-400">
                Status setzen auf <code className="text-[#e4cfa2]">ready_to_publish</code>. Tatsächliches Deploy
                bleibt Edge/Infra mit Freigabe — Soft-Smoke und Pay sind getrennt.
              </p>
              <Button onClick={() => void onMarkReady()} disabled={busy || project.status === 'ready_to_publish'}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span className="ml-2">
                  {project.status === 'ready_to_publish' ? 'Bereit zur Freigabe' : 'Als freigabebereit markieren'}
                </span>
              </Button>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function StepPlaceholder({
  title,
  body,
  busy,
  onNext,
  nextLabel,
}: {
  title: string;
  body: string;
  busy: boolean;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <Card>
      <CardHeader eyebrow="Modernize" title={title} />
      <CardBody>
        <p className="mb-4 text-sm text-titanium-400">{body}</p>
        <Button onClick={onNext} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          <span className={busy ? 'ml-2' : ''}>{nextLabel}</span>
        </Button>
      </CardBody>
    </Card>
  );
}
