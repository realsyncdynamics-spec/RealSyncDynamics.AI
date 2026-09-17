/**
 * RealSyncDynamics.AI Web App Builder — code workbench.
 * Puck remains the visual editor at /builder/:slug. This surface is additive.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { FileCode2, Loader2, Play, Plus, RefreshCw, ShieldOff, Square, Trash2, Wrench } from 'lucide-react';
import { BoltEngine } from './bolt/engine';
import { htmlFromFiles, sandboxTokens } from './bolt/preview';
import { classifyPrompt } from './bolt/governance-gate';
import { diagnoseFiles, type Diagnostic } from './bolt/diagnostics';
import { repairPrompt } from './bolt/error-recovery';
import { generateViaRealSyncGatewayStream } from './gateway';
import {
  deleteBuilderProject,
  listBuilderProjects,
  loadBuilderProject,
  saveBuilderProject,
} from './persist/persist-api';
import {
  deleteProject,
  filesFromRecords,
  listProjects,
  loadProject,
  saveProject,
  type BuilderProject,
  type ProjectMeta,
} from './bolt/project-store';
import type { AuditRecord, EngineRunResult, FileRecord, GovernanceContext } from './bolt/types';

type Pane = 'preview' | 'code' | 'audit';

const GATE_PROBE =
  '<boltArtifact title="gate"><boltAction type="file" filePath="index.html">held</boltAction></boltArtifact>';

const FOLLOW_UPS = [
  'Füge eine Kundentabelle hinzu.',
  'Baue eine Detailansicht.',
  'Ändere das Dashboard auf Dark Mode.',
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'projekt';
}

function newProject(tenantId: string, title: string, slug: string): BuilderProject {
  return {
    id: 'draft',
    tenantId,
    slug: slugify(slug || title),
    title,
    files: {},
    merkle: '',
    audit: [],
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

function toLocal(row: {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  files: Record<string, string>;
  merkle: string;
  audit: AuditRecord[];
  messages: BuilderProject['messages'];
  updatedAt: string;
}): BuilderProject {
  return {
    id: row.id,
    tenantId: row.tenantId,
    slug: row.slug,
    title: row.title,
    files: row.files,
    merkle: row.merkle,
    audit: row.audit,
    messages: row.messages,
    updatedAt: row.updatedAt,
  };
}

export function BoltWorkbench({
  ctx,
  projectSlug,
}: {
  ctx: GovernanceContext;
  projectSlug: string;
}): ReactElement {
  const engineRef = useRef(new BoltEngine(ctx));
  const abortRef = useRef<AbortController | null>(null);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [project, setProject] = useState<BuilderProject>(() =>
    newProject(ctx.tenantId, projectSlug, projectSlug),
  );
  const [prompt, setPrompt] = useState('Erstelle eine moderne CRM-Web-App mit Dashboard.');
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EngineRunResult | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pane, setPane] = useState<Pane>('preview');
  const [isolation, setIsolation] = useState<'static' | 'interactive'>('interactive');
  const [previewKey, setPreviewKey] = useState(0);
  const [serverPersist, setServerPersist] = useState<'idle' | 'ok' | 'blocked'>('idle');
  const [lastChange, setLastChange] = useState<string | undefined>();

  const refreshList = useCallback(() => {
    void (async () => {
      const remote = await listBuilderProjects(ctx.tenantId);
      if (remote.kind === 'ok') {
        setProjects(remote.data);
        setServerPersist('ok');
        return;
      }
      setProjects(listProjects(ctx.tenantId));
      if (remote.code === 'UNKNOWN_ENDPOINT' || remote.status === 404) setServerPersist('blocked');
    })();
  }, [ctx.tenantId]);

  useEffect(() => {
    engineRef.current = new BoltEngine(ctx);
    void (async () => {
      const remote = await listBuilderProjects(ctx.tenantId);
      let listed: ProjectMeta[] = listProjects(ctx.tenantId);
      if (remote.kind === 'ok') {
        listed = remote.data;
        setServerPersist('ok');
      } else if (remote.code === 'UNKNOWN_ENDPOINT' || remote.status === 404) {
        setServerPersist('blocked');
      }
      setProjects(listed);
      const match = listed.find((p) => p.slug === projectSlug) ?? listed[0];
      if (match) {
        const loadedRemote = await loadBuilderProject(ctx.tenantId, match.id);
        const loaded = loadedRemote.kind === 'ok' ? toLocal(loadedRemote.data) : loadProject(ctx.tenantId, match.id);
        if (loaded) {
          setProject(loaded);
          await engineRef.current.hydrate(loaded.files);
          const snap = await engineRef.current.store.snapshot();
          setResult({
            messageId: 'hydrate',
            events: [],
            runs: [],
            audit: loaded.audit,
            snapshot: snap,
            blocked: false,
          });
          setActivePath(Object.keys(loaded.files)[0] ?? null);
          return;
        }
      }
      setProject(newProject(ctx.tenantId, projectSlug, projectSlug));
      setResult(null);
      setActivePath(null);
      setStream('');
    })();
  }, [ctx, projectSlug]);

  useEffect(() => {
    engineRef.current.setCtx(ctx);
  }, [ctx]);

  const files = useMemo(() => Object.values(result?.snapshot.files ?? {}), [result]);
  const current: FileRecord | undefined = files.find((f) => f.path === activePath) ?? files[0];
  const previewHtml = useMemo(
    () => (files.length ? htmlFromFiles(files, isolation) : ''),
    [files, isolation],
  );
  const diagnostics: Diagnostic[] = useMemo(() => diagnoseFiles(files), [files]);
  const tally = useMemo(() => {
    const runs = result?.runs ?? [];
    return {
      allow: runs.filter((r) => r.status === 'complete').length,
      hold: runs.filter((r) => r.gate.decision === 'require_approval').length,
      block: runs.filter((r) => r.gate.decision === 'block').length,
    };
  }, [result]);
  const held = tally.hold > 0;
  const blockedTurn = (result?.blocked ?? false) || tally.block > 0;

  useEffect(() => {
    if (current) setDraft(current.content);
  }, [current?.path, current?.sha256]);

  async function persist(next: BuilderProject, snapFiles: Record<string, string>, audit: AuditRecord[], merkle: string) {
    const stored: BuilderProject = {
      ...next,
      tenantId: ctx.tenantId,
      slug: next.slug || projectSlug,
      files: snapFiles,
      merkle,
      audit: audit.slice(-80),
      updatedAt: new Date().toISOString(),
    };
    saveProject({
      ...stored,
      id: stored.id === 'draft' ? (globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}`) : stored.id,
    });
    const remote = await saveBuilderProject(ctx.tenantId, {
      slug: stored.slug,
      title: stored.title || projectSlug,
      files: snapFiles,
      merkle,
      audit: stored.audit,
      messages: stored.messages,
    });
    if (remote.kind === 'ok') {
      const row = toLocal(remote.data);
      setProject(row);
      saveProject(row);
      setServerPersist('ok');
    } else {
      setProject(stored.id === 'draft' ? { ...stored, id: stored.slug } : stored);
      if (remote.code === 'UNKNOWN_ENDPOINT' || remote.status === 404) setServerPersist('blocked');
      setError(remote.message);
    }
    refreshList();
  }

  async function applyEngine(res: EngineRunResult, assistantText?: string) {
    setResult(res);
    setPreviewKey((k) => k + 1);
    const paths = Object.keys(res.snapshot.files);
    setActivePath((prev) => (prev && res.snapshot.files[prev] ? prev : (paths[0] ?? null)));
    const heldNow = res.runs.some((r) => r.gate.decision === 'require_approval');
    const blockedNow = res.blocked || res.runs.some((r) => r.gate.decision === 'block');
    setPane(paths.length === 0 || heldNow || blockedNow ? 'audit' : 'preview');
    const messages = [
      ...project.messages,
      ...(assistantText
        ? [{ role: 'assistant' as const, text: assistantText.slice(0, 800), at: new Date().toISOString() }]
        : []),
    ].slice(-24);
    await persist(
      { ...project, messages, title: project.title || projectSlug },
      filesFromRecords(Object.values(res.snapshot.files)),
      res.audit,
      res.snapshot.merkle,
    );
  }

  async function run(nextPrompt: string, repair?: string) {
    if (busy) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setError(null);
    setStream('');
    const userMsg = { role: 'user' as const, text: nextPrompt, at: new Date().toISOString() };
    setProject((p) => ({ ...p, messages: [...p.messages, userMsg] }));
    try {
      engineRef.current.setCtx(ctx);
      const risk = classifyPrompt(nextPrompt);
      const gated =
        !ctx.authenticated ||
        !ctx.tenantVerified ||
        !ctx.entitlementBuilder ||
        risk === 'high' ||
        risk === 'unacceptable';
      if (gated) {
        setStream('Governance-Gate — kein Modellaufruf.');
        const res = await engineRef.current.ingest(`m-${Date.now()}`, GATE_PROBE, nextPrompt);
        if (ac.signal.aborted) return;
        await applyEngine(res, 'Gate geschlossen. Kein Modellaufruf.');
        return;
      }
      setStream('RealSync AI Gateway …');
      const currentFiles = engineRef.current.store.list().map((f) => ({ path: f.path, content: f.content }));
      const gen = await generateViaRealSyncGatewayStream(
        {
          prompt: nextPrompt,
          tenantId: ctx.tenantId,
          files: currentFiles,
          repair,
          diagnostics,
          lastChange,
          riskClass: risk,
        },
        (full) => {
          if (!ac.signal.aborted) setStream(full);
        },
        ac.signal,
      );
      if (ac.signal.aborted || ('aborted' in gen && gen.aborted)) {
        setError('Abgebrochen. Es wurde nichts geschrieben.');
        setStream('');
        setPane('audit');
        return;
      }
      if (!gen.ok) {
        setError(gen.error);
        setStream('');
        setPane('audit');
        return;
      }
      if (ac.signal.aborted) {
        setError('Abgebrochen. Es wurde nichts geschrieben.');
        setStream('');
        setPane('audit');
        return;
      }
      setStream(gen.text);
      const res = await engineRef.current.ingest(`m-${Date.now()}`, gen.text, nextPrompt);
      if (ac.signal.aborted) return;
      setLastChange(nextPrompt.slice(0, 200));
      await applyEngine(res, gen.text);
    } catch (err) {
      if (ac.signal.aborted) {
        setError('Abgebrochen. Es wurde nichts geschrieben.');
        setStream('');
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setBusy(false);
    }
  }

  function cancelRun() {
    abortRef.current?.abort();
  }

  async function saveCurrent() {
    if (!current) return;
    const res = await engineRef.current.writeFile(current.path, draft);
    await applyEngine(res);
  }

  async function removeCurrent() {
    if (!current) return;
    const res = await engineRef.current.deleteFile(current.path);
    await applyEngine(res);
  }

  function createNew() {
    const p = newProject(ctx.tenantId, projectSlug, projectSlug);
    engineRef.current = new BoltEngine(ctx);
    setProject(p);
    setResult(null);
    setActivePath(null);
    setStream('');
    setError(null);
    setPrompt('Erstelle eine moderne CRM-Web-App mit Dashboard.');
  }

  function openListed(id: string) {
    void (async () => {
      const remote = await loadBuilderProject(ctx.tenantId, id);
      const loaded = remote.kind === 'ok' ? toLocal(remote.data) : loadProject(ctx.tenantId, id);
      if (!loaded) return;
      engineRef.current = new BoltEngine(ctx);
      await engineRef.current.hydrate(loaded.files);
      const snap = await engineRef.current.store.snapshot();
      setProject(loaded);
      setResult({
        messageId: 'load',
        events: [],
        runs: [],
        audit: loaded.audit,
        snapshot: snap,
        blocked: false,
      });
      setActivePath(Object.keys(loaded.files)[0] ?? null);
      setPane('preview');
    })();
  }

  function removeListed(id: string) {
    void (async () => {
      const remote = await deleteBuilderProject(ctx.tenantId, id);
      if (remote.kind !== 'ok') deleteProject(ctx.tenantId, id);
      refreshList();
      if (project.id === id) createNew();
    })();
  }

  const risk = classifyPrompt(prompt);

  return (
    <div className="grid min-h-[calc(100dvh-52px)] grid-rows-[auto_minmax(0,1fr)] bg-[#0A0A0B] text-[#E2E2E2]" data-testid="bolt-workbench">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <span className="font-mono text-[10px] tracking-[0.16em] text-white/45 uppercase" data-testid="persist-state">
          {project.id === 'draft'
            ? 'Entwurf'
            : serverPersist === 'ok'
              ? `Server · ${(project.merkle || '—').slice(0, 8)}`
              : serverPersist === 'blocked'
                ? `Browser-Cache · Server nicht ausgerollt · ${(project.merkle || '—').slice(0, 8)}`
                : `Gespeichert · ${(project.merkle || '—').slice(0, 8)}`}
        </span>
        <span className="font-mono text-[10px] text-white/45" data-testid="gate-tally">
          ALLOW {tally.allow} · HOLD {tally.hold} · BLOCK {tally.block}
        </span>
      </div>

      <div className="grid min-h-0 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.1fr)]">
        <aside className="border-b border-white/10 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="font-mono text-[10px] tracking-[0.16em] text-white/45 uppercase">Projekte</span>
            <button type="button" onClick={createNew} className="inline-flex min-h-11 items-center gap-1 px-2 text-xs text-[#0052FF]" aria-label="Neues Projekt">
              <Plus className="size-4" /> Neu
            </button>
          </div>
          <ul>
            {projects.length === 0 ? (
              <li className="px-3 py-3 text-xs text-white/45">Noch kein Stand gespeichert.</li>
            ) : (
              projects.map((p) => (
                <li key={p.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => openListed(p.id)}
                    className={`flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 px-3 text-left text-xs ${
                      project.id === p.id ? 'bg-[#0052FF]/20 text-[#E2E2E2]' : 'text-white/55 hover:text-[#E2E2E2]'
                    }`}
                  >
                    <span className="truncate">{p.title}</span>
                    <span className="font-mono text-[10px]">{p.fileCount}</span>
                  </button>
                  <button type="button" aria-label={`Projekt ${p.title} löschen`} onClick={() => removeListed(p.id)} className="min-h-11 px-2 text-white/45 hover:text-[#E24A4A]">
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-white/10 px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-white/45 uppercase">
            Dateien · {files.length}
          </div>
          <ul>
            {files.length === 0 ? (
              <li className="px-3 py-3 text-xs text-white/45">Keine Datei.</li>
            ) : (
              files.map((f) => (
                <li key={f.path}>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePath(f.path);
                      setPane('code');
                    }}
                    className={`flex min-h-11 w-full items-center gap-2 px-3 text-left text-xs ${
                      activePath === f.path ? 'bg-[#0052FF]/20 text-[#E2E2E2]' : 'text-white/55 hover:text-[#E2E2E2]'
                    }`}
                  >
                    <FileCode2 className="size-3.5 shrink-0" />
                    <span className="truncate font-mono">{f.path}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)] border-b border-white/10 lg:border-r lg:border-b-0">
          <form
            className="grid gap-2 border-b border-white/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!prompt.trim()) return;
              void run(prompt.trim());
            }}
          >
            <label htmlFor="rsd-code-prompt" className="font-mono text-[10px] tracking-[0.16em] text-white/45 uppercase">
              Auftrag · Risiko {risk}
            </label>
            <textarea
              id="rsd-code-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="min-h-20 w-full resize-y border border-white/15 bg-[#101114] px-3 py-2 text-sm outline-none focus:border-[#0052FF]"
            />
            <div className="flex flex-wrap gap-2">
              {FOLLOW_UPS.map((follow) => (
                <button
                  key={follow}
                  type="button"
                  onClick={() => setPrompt(follow)}
                  title={follow}
                  className="min-h-11 border border-white/15 px-3 text-xs text-white/55 hover:text-[#E2E2E2]"
                >
                  Vorlage: {follow.split(' ')[0]}
                </button>
              ))}
              <button
                type="submit"
                disabled={busy || !prompt.trim()}
                className="ml-auto inline-flex min-h-11 items-center gap-2 bg-[#0052FF] px-4 text-sm font-medium disabled:opacity-40"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Ausführen
              </button>
              {busy ? (
                <button
                  type="button"
                  onClick={cancelRun}
                  className="inline-flex min-h-11 items-center gap-2 border border-[#E24A4A]/60 px-4 text-sm text-[#E24A4A]"
                >
                  <Square className="size-3.5 fill-current" />
                  Abbrechen
                </button>
              ) : null}
            </div>
            {error ? <p className="text-sm text-[#E24A4A]">{error}</p> : null}
            {stream ? (
              <pre className="max-h-32 overflow-auto font-mono text-[11px] leading-5 text-white/55 whitespace-pre-wrap">{stream}</pre>
            ) : null}
            <p className="font-mono text-[10px] text-white/35">
              Antwort über das RealSync AI-Gateway (`app_builder_code`), Token-Stream, kein Browser-Key.
            </p>
          </form>
          <div className="min-h-0 overflow-auto p-3">
            <ol className="grid gap-2">
              {project.messages.slice(-8).map((m, i) => (
                <li key={`${m.at}-${i}`} className="border border-white/10 bg-[#101114] px-3 py-2">
                  <p className="font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">{m.role}</p>
                  <p className="mt-1 text-sm leading-6">{m.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)]">
          <div className="grid grid-cols-3 border-b border-white/10">
            {(['preview', 'code', 'audit'] as Pane[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setPane(id)}
                className={`min-h-11 text-xs tracking-[0.12em] uppercase ${
                  pane === id ? 'bg-[#0052FF] text-[#E2E2E2]' : 'bg-[#101114] text-white/55'
                }`}
              >
                {id === 'preview' ? 'Vorschau' : id === 'code' ? 'Code' : 'Prüfpfad'}
              </button>
            ))}
          </div>
          {held ? (
            <div className="border-b border-[#E4C56A]/40 bg-[#E4C56A]/10 px-3 py-2 text-xs text-[#E4C56A]">
              HOLD — menschliche Freigabe. Dateien wurden nicht geschrieben.
            </div>
          ) : null}
          {blockedTurn && !held ? (
            <div className="border-b border-[#E24A4A]/40 bg-[#E24A4A]/10 px-3 py-2 text-xs text-[#E24A4A]">
              BLOCK — Mutation abgewiesen. Details im Prüfpfad.
            </div>
          ) : null}

          {pane === 'preview' && (
            <div className="grid min-h-[320px] grid-rows-[auto_minmax(0,1fr)]">
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
                <button type="button" onClick={() => setPreviewKey((k) => k + 1)} className="inline-flex min-h-11 items-center gap-2 border border-white/15 px-3 text-xs">
                  <RefreshCw className="size-3.5" /> Aktualisieren
                </button>
                <label className="inline-flex min-h-11 items-center gap-2 text-xs text-white/55">
                  <input
                    type="checkbox"
                    checked={isolation === 'interactive'}
                    onChange={(e) => setIsolation(e.target.checked ? 'interactive' : 'static')}
                    className="size-4 accent-[#0052FF]"
                  />
                  Skripte in der Vorschau
                </label>
                {diagnostics.some((d) => d.severity === 'error') ? (
                  <button
                    type="button"
                    onClick={() => void run(prompt, repairPrompt(prompt, result?.runs ?? []))}
                    className="inline-flex min-h-11 items-center gap-2 border border-[#E4C56A] px-3 text-xs text-[#E4C56A]"
                  >
                    <Wrench className="size-3.5" /> Korrigieren
                  </button>
                ) : null}
              </div>
              {previewHtml ? (
                <iframe
                  key={previewKey}
                  title="Governed preview"
                  srcDoc={previewHtml}
                  sandbox={sandboxTokens(isolation)}
                  referrerPolicy="no-referrer"
                  allow=""
                  className="h-full min-h-[360px] w-full bg-[#0A0A0B]"
                />
              ) : (
                <div className="grid place-items-center p-6 text-center">
                  <ShieldOff className="mb-3 size-5 text-white/45" />
                  <p className="max-w-sm text-sm text-white/55">
                    Noch keine Vorschau. Auftrag ausführen — Dateien entstehen nur nach Gate-Freigabe.
                  </p>
                </div>
              )}
            </div>
          )}

          {pane === 'code' && (
            <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
                <span className="font-mono text-[11px] text-white/45">{current?.path ?? 'keine Datei'}</span>
                <button type="button" disabled={!current} onClick={() => void saveCurrent()} className="min-h-11 border border-white/15 px-3 text-xs disabled:opacity-40">
                  Datei speichern
                </button>
                <button
                  type="button"
                  disabled={!current}
                  onClick={() => void removeCurrent()}
                  className="inline-flex min-h-11 items-center gap-1 border border-white/15 px-3 text-xs text-[#E24A4A] disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" /> Löschen
                </button>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                className="min-h-[360px] w-full resize-none bg-[#0A0A0B] p-4 font-mono text-[11px] leading-5 outline-none"
              />
            </div>
          )}

          {pane === 'audit' && (
            <div className="min-h-0 overflow-auto">
              {diagnostics.length > 0 ? (
                <ul className="border-b border-white/10">
                  {diagnostics.map((d, i) => (
                    <li key={`${d.path}-${i}`} className="px-3 py-2 text-xs">
                      <span className={d.severity === 'error' ? 'text-[#E24A4A]' : 'text-[#E4C56A]'}>{d.severity}</span>
                      <span className="ml-2 font-mono text-white/45">{d.path}</span>
                      <p className="mt-1">{d.message}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="border-b border-white/10 px-3 py-2 font-mono text-[10px] text-white/45">
                EVENTS {(result?.audit ?? project.audit).length} · MERKLE {((result?.snapshot.merkle ?? project.merkle) || '—').slice(0, 16)}
              </div>
              <ol>
                {[...(result?.audit ?? project.audit)].reverse().map((r) => (
                  <li key={r.id} className="grid gap-1 border-b border-white/10 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-mono text-[10px] tracking-[0.12em] uppercase ${
                          r.decision === 'block'
                            ? 'text-[#E24A4A]'
                            : r.decision === 'require_approval'
                              ? 'text-[#E4C56A]'
                              : 'text-[#3DDC97]'
                        }`}
                      >
                        {r.decision}
                      </span>
                      <span className="font-mono text-[10px] text-white/45">{r.event}</span>
                    </div>
                    <p className="text-xs leading-5">{r.detail}</p>
                    <p className="font-mono text-[10px] text-white/45">
                      {r.control} · {r.riskClass}
                      {r.evidenceSha256 ? ` · ${r.evidenceSha256.slice(0, 12)}…` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default BoltWorkbench;
